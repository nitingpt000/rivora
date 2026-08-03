import { createHash } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';
import { API_KEY_SCOPES_KEY, IS_PUBLIC_KEY, type AuthenticatedRequest } from './auth.decorators';
import type { JwtPayload } from './auth.service';

/**
 * Authentication, applied globally.
 *
 * Registered as an APP_GUARD so every route is protected unless it opts out
 * with `@Public()`. The inverse — protecting routes individually — fails open:
 * a new endpoint added without the decorator would be world-readable, and
 * nothing would flag it.
 *
 * Two credentials are accepted. A JWT identifies a person's wallet session; an
 * API key identifies a partner service, and is only accepted on routes that
 * declare which scopes it needs.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & {
      headers: Record<string, string | string[] | undefined>;
    }>();

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    /**
     * A route declaring scopes is authenticated by key, full stop.
     *
     * This used to fall through to the JWT branch when no key was presented,
     * which meant any signed-in wallet could call the partner Score API
     * without one — taking the metered product for free, past the partner
     * throttle, and without being counted. A session is not a substitute for
     * a credential issued to a service.
     *
     * Surfaces that a person signs into with a wallet use `@Roles` on their
     * own controller instead; the two are deliberately not interchangeable.
     */
    if (requiredScopes?.length) {
      const key = this.header(request, 'x-api-key');
      if (!key) {
        throw new UnauthorizedException({
          error: 'This endpoint requires an API key, sent as `x-api-key`.',
          code: 'api_key_required',
          statusCode: 401,
        });
      }
      return this.authenticateApiKey(request, key, requiredScopes);
    }

    const authorization = this.header(request, 'authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: 'Authentication required. Sign in at POST /api/v1/auth/verify.',
        code: 'unauthenticated',
        statusCode: 401,
      });
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(authorization.slice(7));
      request.user = {
        address: payload.sub,
        role: payload.role,
        home: null,
        known: payload.role !== null,
        ...(payload.borrowerId ? { borrowerId: payload.borrowerId } : {}),
      };
      return true;
    } catch {
      // Expired and forged tokens are deliberately indistinguishable to the
      // caller; the difference only tells an attacker which one they have.
      throw new UnauthorizedException({
        error: 'Session token is invalid or has expired.',
        code: 'invalid_token',
        statusCode: 401,
      });
    }
  }

  /**
   * Authenticates a partner key.
   *
   * Only the SHA-256 is stored and compared, so a database dump does not hand
   * an attacker working credentials.
   */
  private async authenticateApiKey(
    request: AuthenticatedRequest,
    presented: string,
    requiredScopes: string[],
  ): Promise<boolean> {
    const keyHash = createHash('sha256').update(presented).digest('hex');
    const record = await this.prisma.apiKey.findUnique({ where: { keyHash } });

    if (!record || record.revokedAt) {
      throw new UnauthorizedException({
        error: 'API key is unknown or has been revoked.',
        code: 'invalid_api_key',
        statusCode: 401,
      });
    }

    const missing = requiredScopes.filter((scope) => !record.scopes.includes(scope));
    if (missing.length) {
      throw new UnauthorizedException({
        error: `API key is missing the ${missing.join(', ')} scope.`,
        code: 'insufficient_scope',
        statusCode: 403,
      });
    }

    // Fire-and-forget: a failed bookkeeping write must not fail the request.
    void this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    request.apiKey = { id: record.id, label: record.label, scopes: record.scopes };
    return true;
  }

  private header(
    request: { headers: Record<string, string | string[] | undefined> },
    name: string,
  ): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
