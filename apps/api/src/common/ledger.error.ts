import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A refusal the caller should read.
 *
 * Distinct from a bug: "you asked to draw more than your available credit" is
 * a correct, expected answer that the UI renders verbatim, so it carries a
 * machine-readable `code` for branching and a message written for a person.
 * 422 rather than 400 — the request was well-formed, the protocol declined it.
 */
export class LedgerError extends HttpException {
  constructor(
    message: string,
    readonly code: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super({ error: message, code, statusCode: status }, status);
  }
}
