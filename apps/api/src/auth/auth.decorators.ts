import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

import type { SessionUserDto } from './auth.dto';

export const IS_PUBLIC_KEY = 'auth:public';
export const ROLES_KEY = 'auth:roles';
export const API_KEY_SCOPES_KEY = 'auth:apiKeyScopes';

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

/** The request correlation id, for echoing into responses and audit rows. */
export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string =>
  ctx.switchToHttp().getRequest<AuthenticatedRequest>().requestId ?? 'unknown',
);
