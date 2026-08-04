import { Controller, Get, Headers, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Public } from '../auth/auth.decorators';
import { X402Service } from './x402.service';
import type { PaymentAuthorization } from './payment';

/**
 * The demo borrower's paid API. PRD §35.4, §37.
 *
 * Public and unauthenticated by design: the payment *is* the authentication.
 * That is the point of x402 — a caller with no account and no key pays per
 * request, which is what makes an autonomous agent a viable customer.
 *
 * Not part of the protocol surface. This is the service being lent against,
 * kept in the same process only so the demo has a real endpoint to point at.
 */
@ApiTags('x402')
@Public()
@Controller('x402')
export class X402Controller {
  constructor(private readonly x402: X402Service) {}

  @Get('quote')
  @ApiOperation({
    summary: 'A market-data quote — paid, per request',
    description: [
      'Answers an unpaid request with **402 Payment Required** and an x402 challenge naming the price, the asset and where to pay. Retry with an `X-PAYMENT` header carrying a base64-encoded EIP-3009 `TransferWithAuthorization` signed by the payer.',
      '',
      'The signature is checked cryptographically and its nonce is single-use, so an authorization cannot be replayed against a second request. A verified payment is recorded as revenue and reaches the underwriting window through the same path an external indexer would use.',
      '',
      'Settlement is not performed here. Circle Gateway batches authorizations and settles them onchain; a seller serves on the strength of the signature, which is the premise nanopayments rest on.',
    ].join('\n'),
  })
  @ApiQuery({ name: 'symbol', required: false, example: 'ETH-USD' })
  @ApiResponse({ status: 200, description: 'Paid. The quote.' })
  @ApiResponse({ status: 402, description: 'Unpaid, or the payment was refused. Carries the challenge.' })
  async quote(
    @Query('symbol') symbol = 'ETH-USD',
    @Headers('x-payment') header: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const resource = `/api/v1/x402/quote?symbol=${symbol}`;
    const challenge = await this.x402.challenge(resource);

    if (!challenge) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: 'No service is registered to sell this resource.',
        code: 'no_seller',
      });
      return;
    }

    if (!header) {
      res.status(HttpStatus.PAYMENT_REQUIRED).json(challenge);
      return;
    }

    const auth = decodePayment(header);
    if (!auth) {
      res
        .status(HttpStatus.PAYMENT_REQUIRED)
        .json({ ...challenge, error: 'malformed', reason: 'X-PAYMENT is not valid base64 JSON.' });
      return;
    }

    const settled = await this.x402.settle(auth, resource);
    if (!settled.ok) {
      res
        .status(HttpStatus.PAYMENT_REQUIRED)
        .json({ ...challenge, error: settled.code, reason: settled.reason });
      return;
    }

    res.status(HttpStatus.OK).json({
      symbol,
      // The "data". A real service would return something worth 0.04 USDC;
      // what matters to the protocol is that a payment bought a response.
      price: quoteFor(symbol),
      asOf: new Date().toISOString(),
      paidBy: settled.payer,
      amountPaid: settled.amount,
    });
  }

  @Get('takings')
  @ApiOperation({
    summary: 'What the paid API has earned',
    description:
      'Aggregate only — paid requests, revenue and the count of distinct payers. Payer addresses are never returned; the revenue surfaces carry a pseudonym instead (PRD §21).',
  })
  async takings(): Promise<unknown> {
    return (await this.x402.takings()) ?? { error: 'no_seller' };
  }
}

/** `X-PAYMENT` is base64 JSON, so it survives a header. */
function decodePayment(header: string): PaymentAuthorization | null {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? (parsed as PaymentAuthorization) : null;
  } catch {
    return null;
  }
}

/**
 * A deterministic price per symbol.
 *
 * Deterministic rather than random for the same reason the transaction
 * hashes are: a demo that returns a different number every second cannot be
 * screenshotted as a record of anything.
 */
function quoteFor(symbol: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash ^= symbol.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return Math.round((1000 + (hash % 3_500_000) / 1000) * 100) / 100;
}
