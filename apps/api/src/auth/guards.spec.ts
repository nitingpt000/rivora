import { createHash } from 'node:crypto';

import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { API_KEY_SCOPES_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * These cover the failure directions that matter.
 *
 * A guard that lets the wrong caller through is the bug that does not announce
 * itself, so most of these assert on a *denial* — and specifically that
 * forgetting a decorator leaves a route closed rather than open.
 */
function context(headers: Record<string, string> = {}): ExecutionContext {
  const request: Record<string, unknown> = { headers };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  } as unknown as ExecutionContext;
}

function reflector(values: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => values[key],
  } as unknown as Reflector;
}

const jwt = new JwtService({ secret: 'test-secret-that-is-long-enough-to-pass' });

function prismaWith(apiKey: unknown): PrismaService {
  return {
    apiKey: {
      findUnique: vi.fn(async () => apiKey),
      update: vi.fn(async () => ({})),
    },
  } as unknown as PrismaService;
}

describe('JwtAuthGuard', () => {
  it('lets a route through when it is explicitly public', async () => {
    const guard = new JwtAuthGuard(reflector({ [IS_PUBLIC_KEY]: true }), jwt, prismaWith(null));

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('denies an unauthenticated request when no decorator is present', async () => {
    // The property that matters: a new route with no decorators is closed.
    const guard = new JwtAuthGuard(reflector({}), jwt, prismaWith(null));

    await expect(guard.canActivate(context())).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid bearer token and attaches the caller', async () => {
    const token = await jwt.signAsync({ sub: '0xabc', role: 'borrower', borrowerId: 'b1' });
    const guard = new JwtAuthGuard(reflector({}), jwt, prismaWith(null));
    const ctx = context({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    const request = ctx.switchToHttp().getRequest<{ user?: { address: string; role: string } }>();
    expect(request.user?.address).toBe('0xabc');
    expect(request.user?.role).toBe('borrower');
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = await new JwtService({ secret: 'a-completely-different-secret-value' }).signAsync({
      sub: '0xattacker',
      role: 'ops',
    });
    const guard = new JwtAuthGuard(reflector({}), jwt, prismaWith(null));

    await expect(
      guard.canActivate(context({ authorization: `Bearer ${forged}` })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a malformed authorization header', async () => {
    const guard = new JwtAuthGuard(reflector({}), jwt, prismaWith(null));

    await expect(guard.canActivate(context({ authorization: 'Basic abc' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts an API key carrying the required scope', async () => {
    const key = 'pk_test_example';
    const guard = new JwtAuthGuard(
      reflector({ [API_KEY_SCOPES_KEY]: ['score:read'] }),
      jwt,
      prismaWith({
        id: 'k1',
        label: 'AgentMarket',
        scopes: ['score:read'],
        revokedAt: null,
      }),
    );

    await expect(guard.canActivate(context({ 'x-api-key': key }))).resolves.toBe(true);
  });

  it('looks up API keys by hash, never by plaintext', async () => {
    const key = 'pk_test_example';
    const prisma = prismaWith({ id: 'k1', label: 'A', scopes: ['score:read'], revokedAt: null });
    const guard = new JwtAuthGuard(reflector({ [API_KEY_SCOPES_KEY]: ['score:read'] }), jwt, prisma);

    await guard.canActivate(context({ 'x-api-key': key }));

    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: createHash('sha256').update(key).digest('hex') },
    });
  });

  it('rejects a revoked API key', async () => {
    const guard = new JwtAuthGuard(
      reflector({ [API_KEY_SCOPES_KEY]: ['score:read'] }),
      jwt,
      prismaWith({ id: 'k1', label: 'A', scopes: ['score:read'], revokedAt: new Date() }),
    );

    await expect(guard.canActivate(context({ 'x-api-key': 'k' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an API key missing the required scope', async () => {
    const guard = new JwtAuthGuard(
      reflector({ [API_KEY_SCOPES_KEY]: ['score:read'] }),
      jwt,
      prismaWith({ id: 'k1', label: 'A', scopes: ['other:scope'], revokedAt: null }),
    );

    // The detail lives in the exception's response body, not its `message`.
    await expect(guard.canActivate(context({ 'x-api-key': 'k' }))).rejects.toMatchObject({
      response: { code: 'insufficient_scope', error: expect.stringContaining('score:read') },
    });
  });
});

describe('RolesGuard', () => {
  function ctxWithUser(role: string | null): ExecutionContext {
    const request = { user: role ? { address: '0xabc', role } : undefined, headers: {} };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => vi.fn(),
      getClass: () => vi.fn(),
    } as unknown as ExecutionContext;
  }

  it('allows a route with no role requirement', () => {
    const guard = new RolesGuard(reflector({}));
    expect(guard.canActivate(ctxWithUser('borrower'))).toBe(true);
  });

  it('allows a caller holding the required role', () => {
    const guard = new RolesGuard(reflector({ [ROLES_KEY]: ['borrower'] }));
    expect(guard.canActivate(ctxWithUser('borrower'))).toBe(true);
  });

  it('denies a caller holding a different role', () => {
    // A borrower must not reach the risk operator's cross-borrower views.
    const guard = new RolesGuard(reflector({ [ROLES_KEY]: ['ops'] }));
    expect(() => guard.canActivate(ctxWithUser('borrower'))).toThrow(ForbiddenException);
  });

  it('denies an authenticated wallet with no role at all', () => {
    const guard = new RolesGuard(reflector({ [ROLES_KEY]: ['borrower'] }));
    expect(() => guard.canActivate(ctxWithUser(null))).toThrow(ForbiddenException);
  });

  it('names the required roles in the refusal', () => {
    const guard = new RolesGuard(reflector({ [ROLES_KEY]: ['ops', 'partner'] }));

    expect(() => guard.canActivate(ctxWithUser('lp'))).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'forbidden_role',
          error: expect.stringContaining('ops, partner'),
        }),
      }),
    );
  });
});

describe('JwtAuthGuard — a session is not a substitute for an API key', () => {
  const scoped = { [API_KEY_SCOPES_KEY]: ['score:read'] };

  /**
   * A borrower's JWT once passed on the partner Score API, because the guard
   * fell through to the JWT branch when no key was presented. That handed the
   * metered product to any signed-in wallet, past the partner throttle, and
   * without counting the call.
   */
  it('refuses a bearer token on a route that requires an API key', async () => {
    const guard = new JwtAuthGuard(reflector(scoped), jwt, prismaWith(null));
    const token = await jwt.signAsync({ sub: '0xborrower', role: 'borrower' });

    await expect(
      guard.canActivate(context({ authorization: `Bearer ${token}` })),
    ).rejects.toMatchObject({ response: { code: 'api_key_required' } });
  });

  it('refuses a request carrying neither credential', async () => {
    const guard = new JwtAuthGuard(reflector(scoped), jwt, prismaWith(null));

    await expect(guard.canActivate(context())).rejects.toMatchObject({
      response: { code: 'api_key_required' },
    });
  });

  it('still accepts a valid API key on that route', async () => {
    const key = 'pk_test_valid';
    const guard = new JwtAuthGuard(
      reflector(scoped),
      jwt,
      prismaWith({
        id: 'k1',
        label: 'Partner',
        scopes: ['score:read'],
        revokedAt: null,
        keyHash: createHash('sha256').update(key).digest('hex'),
      }),
    );

    await expect(guard.canActivate(context({ 'x-api-key': key }))).resolves.toBe(true);
  });
});
