import { CallHandler, ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { catchError, concatMap, type Observable } from 'rxjs';

import { METERED_KEY, type AuthenticatedRequest } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Counts every request authenticated by a partner key.
 *
 * Global, and keyed off `request.apiKey` rather than off a route list, so a
 * new keyed endpoint is counted the day it ships instead of the day someone
 * remembers to add it. Requests carrying a JWT are ignored entirely — a
 * borrower reading their own dashboard is not partner usage.
 *
 * Records failures as well as successes. An integrator debugging a 4xx storm
 * needs to see it, and an error rate computed only from the calls that worked
 * is not an error rate.
 *
 * The write is awaited but never allowed to fail the request: this is billing
 * data, so losing it silently is bad, but a bookkeeping error must not turn a
 * successful score lookup into a 500. A dropped row undercounts, which errs in
 * the caller's favour.
 */
@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiUsageInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & AuthenticatedRequest>();
    const apiKey = request.apiKey;

    // Not a partner call. Nothing to meter.
    if (!apiKey) return next.handle();

    const started = Date.now();
    const metered =
      this.reflector.getAllAndOverride<boolean>(METERED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const record = (status: number) =>
      this.write({
        apiKeyId: apiKey.id,
        route: routeTemplate(request),
        method: request.method,
        status,
        subjectHandle: subjectOf(request),
        // Only a metered route that actually answered is charged for. A 404
        // for a borrower who does not exist is a question the caller asked
        // and got a real answer to, but it is not a score.
        billable: metered && status >= 200 && status < 300,
        durationMs: Date.now() - started,
      });

    return next.handle().pipe(
      concatMap(async (body) => {
        const response = context.switchToHttp().getResponse<Response>();
        await record(response.statusCode);
        return body;
      }),
      catchError((cause: unknown) =>
        // Status lives on the thrown exception here — the response has not
        // been written yet, so reading it would report 200 for a failure.
        this.writeThenRethrow(record, statusOf(cause), cause),
      ),
    );
  }

  private async writeThenRethrow(
    record: (status: number) => Promise<void>,
    status: number,
    cause: unknown,
  ): Promise<never> {
    await record(status);
    throw cause;
  }

  private async write(data: {
    apiKeyId: string;
    route: string;
    method: string;
    status: number;
    subjectHandle: string | null;
    billable: boolean;
    durationMs: number;
  }): Promise<void> {
    try {
      await this.prisma.apiKeyUsage.create({ data });
    } catch (cause) {
      this.logger.error(`could not record API key usage: ${String(cause)}`);
    }
  }
}

/**
 * The route template rather than the resolved path.
 *
 * `/partner/score/:handle` instead of the handle itself, so grouping usage by
 * route cannot leak who was looked up into an aggregate somebody else reads.
 */
function routeTemplate(request: Request): string {
  const path = (request.route as { path?: string } | undefined)?.path;
  if (path) return path;

  // No matched route means a 404 — record the fact without echoing an
  // arbitrary caller-supplied path back into storage.
  return 'unmatched';
}

/** The borrower a route names, when it names one. */
function subjectOf(request: Request): string | null {
  const handle = (request.params as Record<string, string> | undefined)?.handle;
  return typeof handle === 'string' && handle.length > 0 ? handle : null;
}

function statusOf(cause: unknown): number {
  const status = (cause as { status?: unknown; getStatus?: () => number })?.status;
  if (typeof status === 'number') return status;

  const getStatus = (cause as { getStatus?: () => number })?.getStatus;
  if (typeof getStatus === 'function') {
    try {
      return getStatus.call(cause);
    } catch {
      /* fall through to 500 */
    }
  }

  return 500;
}
