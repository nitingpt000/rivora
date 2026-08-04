import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { dec, usdc6 } from '../common/decimal';
import { IngestService } from '../ingest/ingest.service';
import { PrismaService } from '../prisma/prisma.service';
import { paymentChallenge, verifyPayment, type PaymentAuthorization } from './payment';

/**
 * The paid API the demo borrower operates. PRD §35.4, §37.
 *
 * This is deliberately *not* the protocol. It is the borrower's own service —
 * a market-data endpoint that charges per request through x402 — and it lives
 * here because the demo needs a real one to point at. Everything the protocol
 * does with the revenue happens downstream of it, through the same ingestion
 * path an external indexer would use.
 *
 * What is real: the 402 challenge, the EIP-3009 signature check, single-use
 * nonces, and the revenue landing in the underwriting window.
 *
 * What is not: settlement. Circle Gateway batches authorizations and settles
 * them onchain; a seller does not, and this does not pretend to. A verified
 * authorization is a cryptographic promise the payer's balance can be
 * debited — which is exactly what nanopayments trade on, and is not the same
 * as money having moved.
 */

/** Price per request. PRD §35.2's simulated service charges this. */
const PRICE_UNITS = 40_000n; // 0.04 USDC

/** A real 20-byte address, as opposed to a truncated display string. */
const PAYABLE = /^0x[0-9a-fA-F]{40}$/;

@Injectable()
export class X402Service {
  private readonly logger = new Logger(X402Service.name);
  private readonly chainId: number;
  private readonly asset: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingest: IngestService,
    config: ConfigService,
  ) {
    this.chainId = config.get<number>('chainId')!;
    this.asset = config.get<string>('usdcAddress')!;
  }

  /**
   * The seller: whichever borrower this deployment is demonstrating.
   *
   * Payment is directed at their Revenue Router when one is deployed, which
   * is the whole thesis — revenue arrives somewhere the protocol can see and
   * take its share from before the borrower does. Falls back to the
   * operating wallet so the endpoint still works before a router exists,
   * and says which it used.
   */
  private async seller() {
    const borrower = await this.prisma.borrower.findFirst({
      orderBy: { registeredAt: 'asc' },
      select: { id: true, handle: true, serviceName: true, routerAddress: true, operatingWallet: true },
    });

    if (!borrower) return null;

    /**
     * `payTo` has to be an address a payer can actually sign a transfer to.
     *
     * Several fields on a borrower are truncated display strings —
     * `0x7f3a…c1d2` reads fine on a screen and is unusable as a payment
     * destination. Advertising one produced a challenge every agent failed
     * on, at the signing step, with an error about the address rather than
     * about the seller. Better to refuse to sell than to sell to nowhere.
     */
    const payTo = [borrower.routerAddress, borrower.operatingWallet].find((candidate) =>
      PAYABLE.test(candidate ?? ''),
    );

    if (!payTo) {
      this.logger.warn(
        `${borrower.handle} has no payable address — router "${borrower.routerAddress}", operating "${borrower.operatingWallet}"`,
      );
      return null;
    }

    return {
      ...borrower,
      payTo,
      routed: payTo === borrower.routerAddress,
    };
  }

  /** What an unpaid request is answered with. */
  async challenge(resource: string) {
    const seller = await this.seller();
    if (!seller) return null;

    return {
      ...paymentChallenge({
        payTo: seller.payTo,
        priceUnits: PRICE_UNITS,
        asset: this.asset,
        chainId: this.chainId,
        resource,
        description: `${seller.serviceName} — one market-data quote`,
      }),
      routed: seller.routed,
    };
  }

  /**
   * Verifies a payment and, if it stands, records it.
   *
   * Returns a discriminated result rather than throwing, because every
   * refusal here is a 402 with a reason the client can act on — a bad
   * signature and an expired authorization need different responses from
   * the payer, and an exception would flatten them.
   */
  async settle(
    auth: PaymentAuthorization,
    resource: string,
  ): Promise<
    { ok: true; payer: string; amount: number } | { ok: false; code: string; reason: string }
  > {
    const seller = await this.seller();
    if (!seller) return { ok: false, code: 'no_seller', reason: 'No service is registered.' };

    const verdict = await verifyPayment(auth, {
      payTo: seller.payTo,
      priceUnits: PRICE_UNITS,
      asset: this.asset,
      chainId: this.chainId,
      // USDC's EIP-712 domain. Fixed rather than read from the contract:
      // a wrong value here rejects every real payment, so it should fail
      // loudly at integration rather than drift silently at runtime.
      domainName: 'USD Coin',
      domainVersion: '2',
      now: Math.floor(Date.now() / 1000),
    });

    if (!verdict.ok) return { ok: false, code: verdict.code, reason: verdict.reason };

    const amount = Number(verdict.value) / 1e6;

    /**
     * The nonce is the replay guard, and the unique constraint is what
     * enforces it — not a prior read. Two concurrent requests carrying the
     * same authorization would both pass a check-then-write; only one can
     * win an insert.
     */
    try {
      await this.prisma.x402Payment.create({
        data: {
          borrowerId: seller.id,
          payer: verdict.payer,
          amount: usdc6(dec(amount)),
          nonce: auth.nonce.toLowerCase(),
          validBefore: new Date(Number(auth.validBefore) * 1000),
          resource,
        },
      });
    } catch (cause) {
      if ((cause as { code?: string }).code === 'P2002') {
        return {
          ok: false,
          code: 'nonce_used',
          reason: 'This authorization has already been spent.',
        };
      }
      throw cause;
    }

    // Revenue, recorded the way an indexer would record it. A failure here
    // must not un-serve a resource the payer has paid for, so it is logged
    // rather than propagated — the payment row is the durable record and a
    // rollup can be rebuilt from it.
    try {
      await this.ingest.recordPayment({
        borrowerId: seller.id,
        handle: seller.handle,
        label: payerLabel(verdict.payer),
        amount,
        at: new Date(),
      });
    } catch (cause) {
      this.logger.error(`payment ${auth.nonce} recorded but not rolled up: ${String(cause)}`);
    }

    return { ok: true, payer: verdict.payer, amount };
  }

  /** What the seller has taken, for the demo surface. */
  async takings() {
    const seller = await this.seller();
    if (!seller) return null;

    const [count, sum, distinct] = await Promise.all([
      this.prisma.x402Payment.count({ where: { borrowerId: seller.id } }),
      this.prisma.x402Payment.aggregate({
        where: { borrowerId: seller.id },
        _sum: { amount: true },
      }),
      this.prisma.x402Payment.findMany({
        where: { borrowerId: seller.id },
        select: { payer: true },
        distinct: ['payer'],
      }),
    ]);

    return {
      service: seller.serviceName,
      handle: seller.handle,
      payTo: seller.payTo,
      routed: seller.routed,
      pricePerRequest: Number(PRICE_UNITS) / 1e6,
      paidRequests: count,
      revenue: Number(sum._sum.amount ?? 0),
      uniquePayers: distinct.length,
    };
  }
}

/**
 * A stable pseudonym for a payer wallet.
 *
 * The revenue surfaces carry this and never the address (PRD §21). Derived
 * rather than sequential so the same wallet gets the same label across
 * restarts without a counter to keep.
 */
export function payerLabel(address: string): string {
  const digest = createHash('sha256').update(address.toLowerCase()).digest('hex');
  return `payer-x${digest.slice(0, 6)}`;
}
