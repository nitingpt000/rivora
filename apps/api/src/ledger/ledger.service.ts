import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { deterministicTxHash } from '../common/tx-hash';
import { PrismaService } from '../prisma/prisma.service';

export interface EventInput {
  type: string;
  who: string;
  amount: string;
  txHash: string;
  note?: string;
  borrowerId?: string;
}

export interface AlertInput {
  icon: string;
  title: string;
  body?: string;
  txHash?: string;
  href?: string;
  cta?: string;
  borrowerId?: string;
}

/**
 * Write helpers shared by every mutating service.
 *
 * Recording an event and minting its transaction hash are the two things every
 * state change does, so they live in one place rather than being re-derived
 * per service — which is how two endpoints end up formatting the same event
 * differently.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Next transaction hash, derived from the height of the event log.
   *
   * Deterministic rather than random, so the same sequence of operations
   * against a fresh database always produces the same hashes. Must be called
   * inside the same transaction as the write it labels, or two concurrent
   * mutations will mint the same hash.
   */
  async nextTxHash(client: Prisma.TransactionClient): Promise<string> {
    const height = await client.activityEvent.count();
    return deterministicTxHash(height + 1);
  }

  async recordEvent(client: Prisma.TransactionClient, input: EventInput): Promise<void> {
    await client.activityEvent.create({
      data: {
        type: input.type,
        who: input.who,
        amount: input.amount,
        txHash: input.txHash,
        note: input.note ?? null,
        borrowerId: input.borrowerId ?? null,
      },
    });
  }

  async recordAlert(client: Prisma.TransactionClient, input: AlertInput): Promise<void> {
    await client.alert.create({
      data: {
        icon: input.icon,
        title: input.title,
        body: input.body ?? null,
        txHash: input.txHash ?? null,
        href: input.href ?? null,
        cta: input.cta ?? null,
        borrowerId: input.borrowerId ?? null,
        unread: true,
      },
    });
  }

  /**
   * Runs `fn` in a transaction — every mutation is all-or-nothing.
   *
   * The timeout is a ceiling, not a hold: in arc mode a broadcast happens
   * inside the money-moving transactions, and Prisma's 5-second default
   * would abort the database write *after* the chain accepted the
   * transaction — the exact split-brain the seam exists to prevent.
   */
  run<T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { maxWait: 10_000, timeout: 60_000 });
  }
}
