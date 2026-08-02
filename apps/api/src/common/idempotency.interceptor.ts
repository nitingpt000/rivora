import { createHash } from 'node:crypto';

import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { concatMap, type Observable, of } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Makes money mutations safe to retry.
 *
 * A client that sends `POST /credit/draw`, loses the connection, and retries
 * has no way to know whether the first call landed. Without this it draws
 * twice. With an `Idempotency-Key` header, the second call replays the first
 * response instead of performing the operation again.
 *
 * Two guards beyond the key itself: the route is recorded, so the same key on
 * a different endpoint is a client bug rather than a retry; and the body is
 * hashed, so a key reused with different arguments is rejected instead of
 * quietly returning an answer to a question nobody asked.
 *
 * Applied per-controller rather than globally — a GET needs none of this, and
 * the write on every request would be pure cost.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;

    if (!key) return next.handle();

    if (key.length > 255) {
      throw new ConflictException({
        error: 'Idempotency-Key must be 255 characters or fewer.',
        code: 'invalid_idempotency_key',
        statusCode: 409,
      });
    }

    const route = `${request.method} ${request.route?.path ?? request.path}`;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');

    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } });

    if (existing) {
      if (existing.route !== route || existing.requestHash !== requestHash) {
        throw new ConflictException({
          error:
            'This Idempotency-Key was already used for a different request. Use a fresh key for a new operation.',
          code: 'idempotency_key_reused',
          statusCode: 409,
        });
      }

      this.logger.log(`Replaying idempotent response for ${route}`);
      return of(existing.response);
    }

    return next.handle().pipe(
      /**
       * `concatMap`, not `tap` — the record has to be durable *before* the
       * response is emitted. A fire-and-forget write leaves a window where a
       * fast retry arrives, finds no record, and performs the operation a
       * second time. Idempotency that races is not idempotency.
       *
       * Recorded after success only: a failed call should stay retryable with
       * the same key rather than being pinned to its own error.
       */
      concatMap(async (response: unknown) => {
        try {
          await this.prisma.idempotencyRecord.create({
            data: { key, route, requestHash, statusCode: 200, response: response as never },
          });
        } catch (cause) {
          // A unique-constraint violation means a concurrent duplicate stored
          // it first, which is the outcome we wanted. Anything else is worth
          // knowing about, but not worth failing a completed operation over.
          this.logger.debug(`Could not persist idempotency record: ${String(cause)}`);
        }
        return response;
      }),
    );
  }
}
