import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';

import { ROLES_KEY, type AuthenticatedRequest } from './auth.decorators';

/**
 * Authorization, applied globally after authentication.
 *
 * Runs on every route but only decides on those carrying `@Roles(...)`.
 * Separate from the auth guard because "who are you" and "may you do this" are
 * different questions with different failure codes — 401 means sign in, 403
 * means signing in again will not help.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // A partner key that satisfied its scopes has already been authorised for
    // exactly what it may do; role checks do not apply to it.
    if (request.apiKey) return true;

    const role = request.user?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException({
        error: `This endpoint is restricted to: ${required.join(', ')}.`,
        code: 'forbidden_role',
        statusCode: 403,
      });
    }

    return true;
  }
}
