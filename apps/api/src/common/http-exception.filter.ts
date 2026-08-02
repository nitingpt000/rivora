import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { AuthenticatedRequest } from '../auth/auth.decorators';

/**
 * The single place an error becomes a response.
 *
 * Two properties matter. Every failure comes back in one shape — `error`,
 * `code`, `statusCode`, `requestId` — so a client branches on `code` rather
 * than parsing prose. And an unexpected error never leaks its message, stack
 * or SQL to the caller: those go to the log with a request id the caller can
 * quote, which is enough to correlate without handing out internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & AuthenticatedRequest>();
    const requestId = request.requestId ?? 'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      response.status(status).json({
        ...normalise(body, status),
        requestId,
      });

      // 5xx from an HttpException is still ours to explain.
      if (status >= 500) {
        this.logger.error(`${request.method} ${request.url} → ${status}`, exception.stack);
      }
      return;
    }

    this.logger.error(
      `${request.method} ${request.url} → 500 [${requestId}]`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error.',
      code: 'internal_error',
      statusCode: 500,
      requestId,
    });
  }
}

/**
 * Folds Nest's several error body shapes into one.
 *
 * `ValidationPipe` produces `{ message: string[] }`, thrown `HttpException`s
 * carry a plain string, and this app's own errors already use the target
 * shape. Without this a client would need three parsers for one API.
 */
function normalise(body: unknown, status: number): { error: string; code: string; statusCode: number } {
  if (typeof body === 'string') {
    return { error: body, code: codeFor(status), statusCode: status };
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;

    if (typeof record.error === 'string' && typeof record.code === 'string') {
      return { error: record.error, code: record.code, statusCode: status };
    }

    const message = record.message;
    if (Array.isArray(message)) {
      return { error: message.join('; '), code: 'validation_failed', statusCode: status };
    }
    if (typeof message === 'string') {
      return { error: message, code: codeFor(status), statusCode: status };
    }
  }

  return { error: 'Request failed.', code: codeFor(status), statusCode: status };
}

function codeFor(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'unprocessable';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'internal_error' : 'error';
  }
}
