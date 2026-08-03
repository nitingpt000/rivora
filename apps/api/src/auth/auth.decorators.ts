import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

import type { SessionUserDto } from './auth.dto';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const API_KEY_SCOPES_KEY = 'auth:apiKeyScopes';
export const METERED_KEY = 'usage:metered';

/**
 * Opts a route out of authentication.
 *
 * Authentication is on by default via a global guard, so forgetting a
 * decorator leaves a route protected rather than open. Exposing something
 * publicly is the deliberate act.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the listed surfaces. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Accepts a partner API key carrying every listed scope, instead of a JWT. */
export const ApiKeyScopes = (...scopes: string[]) => SetMetadata(API_KEY_SCOPES_KEY, scopes);

/**
 * Marks a route as counting against the caller's plan.
 *
 * "Billable" is a commercial claim, so it is a decision recorded in code
 * rather than a word on a dashboard. Off by default: a new endpoint bills
 * nobody until someone deliberately says it should, which is the safe
 * direction to fail in.
 *
 * A metered call is only billed if it succeeded — see `ApiUsageInterceptor`.
 * Errors and sandbox calls are counted for observability but never charged.
 */
export const Metered = () => SetMetadata(METERED_KEY, true);

export interface AuthenticatedRequest {
  user?: SessionUserDto;
  apiKey?: { id: string; label: string; scopes: string[] };
  requestId?: string;
}

/** The authenticated caller, as resolved by the guards. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUserDto | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

/**
 * The partner key that authenticated this request, as resolved by the guards.
 *
 * Usage endpoints read the key from here rather than from a parameter, so
 * there is no shape of call that reports another caller's usage.
 */
export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { id: string; label: string; scopes: string[] } => {
    const key = ctx.switchToHttp().getRequest<AuthenticatedRequest>().apiKey;
    if (!key) {
      // Unreachable behind ApiKeyScopes — the guard rejects first. Throwing
      // rather than returning undefined means a future route that forgets the
      // decorator fails loudly instead of reporting an empty bill.
      throw new Error('CurrentApiKey used on a route that does not require an API key.');
    }
    return key;
  },
);

/** The request correlation id, for echoing into responses and audit rows. */
export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string =>
  ctx.switchToHttp().getRequest<AuthenticatedRequest>().requestId ?? 'unknown',
);
