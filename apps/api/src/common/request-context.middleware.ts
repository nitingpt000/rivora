import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import type { AuthenticatedRequest } from '../auth/auth.decorators';

/**
 * Correlation id and access log.
 *
 * Every request gets an id, echoed in the `x-request-id` response header and
 * in every error body, so a user reporting "it failed" can hand over one
 * string that finds the exact log line. An inbound `x-request-id` is honoured
 * so a trace survives across services.
 *
 * The log line is written on response finish rather than on receipt, because
 * status and duration are the parts worth having.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request & AuthenticatedRequest, res: Response, next: NextFunction): void {
    const inbound = req.headers['x-request-id'];
    const requestId = (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      // The authenticated address, when there is one — enough to attribute a
      // request without logging the token that carried it.
      const actor = req.user?.address ?? req.apiKey?.label ?? 'anon';
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms ${actor} [${requestId}]`;

      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    next();
  }
}
