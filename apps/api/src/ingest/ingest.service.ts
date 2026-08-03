import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AssessmentService } from '../assessment/assessment.service';
import { dec, toNumber, usdc6 } from '../common/decimal';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import type { IngestRevenueDto, IngestResultDto } from './ingest.dto';

/** Days of settled revenue behind the underwriting window. PRD §13.2. */
const WINDOW_DAYS = 30;

/**
 * How far eligible revenue must move before it forces an assessment.
 *
 * PRD §16.6 lists a material revenue change as an assessment trigger without
 * defining material. 10% is the threshold: small enough that a real shift is
 * caught before the next scheduled run, large enough that ordinary daily
 * variation does not reassess the book every morning.
 */
const MATERIAL_CHANGE = 0.1;

/**
 * The write side of the revenue indexer. PRD §25.1.
 *
 * Everything downstream — the score, the limit, the repayment budget — is
 * computed from `RevenueDay` and `PayerSummary`. Before this existed those
 * tables were only ever written by the seed, which meant the whole
 * underwriting chain was arithmetic over a fixture.
 *
 * The window aggregates are *derived* here rather than accepted from the
 * caller. An indexer that could post its own HHI could post a flattering one,
 * and the point of onchain revenue is that the lender does not have to take
 * the borrower's word for it.
 */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly assessments: AssessmentService,
  ) {}

  async record(input: IngestRevenueDto): Promise<IngestResultDto> {
    const borrower = await this.prisma.borrower.findUnique({
      where: { handle: input.handle },
      select: { id: true, handle: true },
    });

    if (!borrower) {
      throw new NotFoundException({
        error: `No borrower is registered under the handle "${input.handle}".`,
        code: 'borrower_not_found',
        statusCode: 404,
      });
    }

    // Date only. Settlement is netted per day, so the time component would
    // silently create a second row for the same day.
    const date = new Date(`${input.date.slice(0, 10)}T00:00:00.000Z`);
    const payers = input.payers ?? [];
    const excluded = payers
      .filter((payer) => payer.excluded)
      .reduce((sum, payer) => sum + payer.amount, 0);

    const { replaced, eligibleBefore } = await this.ledger.run(async (tx) => {
      const existing = await tx.revenueDay.findUnique({
        where: { borrowerId_date: { borrowerId: borrower.id, date } },
        select: { id: true },
      });

      const before = await tx.revenueWindow.findUnique({
        where: { borrowerId: borrower.id },
        select: { eligible: true },
      });

      const day = await tx.revenueDay.upsert({
        where: { borrowerId_date: { borrowerId: borrower.id, date } },
        create: {
          borrowerId: borrower.id,
          date,
          settled: usdc6(dec(input.settled)),
          excluded: usdc6(dec(excluded)),
          requests: input.requests,
        },
        // A corrected batch replaces the earlier reading. Adding to it would
        // double-count a retry, and a retry is the normal case for an indexer.
        update: {
          settled: usdc6(dec(input.settled)),
          excluded: usdc6(dec(excluded)),
          requests: input.requests,
        },
        select: { id: true },
      });

      if (payers.length > 0) {
        // Replace the day's breakdown wholesale, for the same reason the day
        // itself is replaced: a correction is a new reading, not an addition.
        await tx.revenueDayPayer.deleteMany({ where: { revenueDayId: day.id } });
        await tx.revenueDayPayer.createMany({
          data: payers.map((payer) => ({
            revenueDayId: day.id,
            label: payer.label,
            amount: usdc6(dec(payer.amount)),
            requests: payer.requests,
            excluded: payer.excluded ?? false,
            exclusionReason: payer.exclusionReason ?? null,
          })),
        });
      }

      await this.recomputeWindow(tx, borrower.id);

      const txHash = await this.ledger.nextTxHash(tx);
      await this.ledger.recordEvent(tx, {
        type: 'revenue.settled',
        who: borrower.handle,
        amount: `${input.settled.toFixed(2)} USDC`,
        txHash,
        note: `${input.requests.toLocaleString('en-US')} requests · ${input.date.slice(0, 10)}`,
        borrowerId: borrower.id,
      });

      return { replaced: existing !== null, eligibleBefore: toNumber(before?.eligible ?? 0) };
    });

    const after = await this.prisma.revenueWindow.findUnique({
      where: { borrowerId: borrower.id },
      select: { eligible: true },
    });
    const eligibleAfter = toNumber(after?.eligible ?? 0);

    // Outside the transaction: `reassess` opens its own, and it should read
    // the window this write produced rather than the one it replaced.
    const material =
      eligibleBefore > 0
        ? Math.abs(eligibleAfter - eligibleBefore) / eligibleBefore >= MATERIAL_CHANGE
        : eligibleAfter > 0;

    if (material) {
      try {
        await this.assessments.reassess(borrower.id, 'material revenue change');
      } catch (cause) {
        // The revenue is recorded either way. A failed assessment is a
        // scheduling problem, not a reason to reject observed settlement.
        this.logger.error(`could not reassess ${borrower.handle}: ${String(cause)}`);
        return this.result(input, excluded, replaced, eligibleAfter, false);
      }
    }

    return this.result(input, excluded, replaced, eligibleAfter, material);
  }

  private result(
    input: IngestRevenueDto,
    excluded: number,
    replaced: boolean,
    windowEligible: number,
    reassessed: boolean,
  ): IngestResultDto {
    return {
      handle: input.handle,
      date: input.date.slice(0, 10),
      settled: input.settled,
      excluded,
      replaced,
      windowEligible,
      reassessed,
    };
  }

  /**
   * Rebuilds `PayerSummary` from the per-day rows inside the window.
   *
   * A materialised rollup, not an accumulator. Recomputed from the day grain
   * every time, so a payer whose last activity has aged past the window
   * disappears from it — which is what makes concentration a 30-day measure
   * rather than a lifetime one.
   */
  private async rebuildPayerSummaries(
    tx: Prisma.TransactionClient,
    borrowerId: string,
    window: Array<{ id: string }>,
  ): Promise<{
    largestPayerPct: number;
    hhi: number;
    uniquePayers: number;
    repeatPayers: number;
  }> {
    const rows = await tx.revenueDayPayer.findMany({
      where: { revenueDayId: { in: window.map((day) => day.id) } },
      select: {
        label: true,
        amount: true,
        requests: true,
        excluded: true,
        exclusionReason: true,
        revenueDay: { select: { date: true } },
      },
    });

    interface Rolled {
      revenue: number;
      requests: number;
      days: Set<string>;
      firstSeenAt: Date;
      excluded: boolean;
      exclusionReason: string | null;
    }

    const byLabel = new Map<string, Rolled>();

    for (const row of rows) {
      const current = byLabel.get(row.label);
      const date = row.revenueDay.date;

      if (!current) {
        byLabel.set(row.label, {
          revenue: toNumber(row.amount),
          requests: row.requests,
          days: new Set([date.toISOString()]),
          firstSeenAt: date,
          excluded: row.excluded,
          exclusionReason: row.exclusionReason,
        });
        continue;
      }

      current.revenue += toNumber(row.amount);
      current.requests += row.requests;
      current.days.add(date.toISOString());
      if (date < current.firstSeenAt) current.firstSeenAt = date;
      // Latest reading wins: an exclusion lifted on a later day should not be
      // reimposed by an earlier one.
      if (date >= current.firstSeenAt) {
        current.excluded = row.excluded;
        current.exclusionReason = row.exclusionReason;
      }
    }

    const included = [...byLabel.entries()].filter(([, payer]) => !payer.excluded);
    const total = included.reduce((sum, [, payer]) => sum + payer.revenue, 0);

    let largestPayerPct = 0;
    let hhi = 0;

    // Rows for payers no longer in the window are removed, not left stale.
    await tx.payerSummary.deleteMany({
      where: { borrowerId, label: { notIn: [...byLabel.keys()] } },
    });

    for (const [label, payer] of byLabel) {
      const share = total > 0 && !payer.excluded ? (payer.revenue / total) * 100 : 0;
      if (share > largestPayerPct) largestPayerPct = share;
      hhi += share * share;

      await tx.payerSummary.upsert({
        where: { borrowerId_label: { borrowerId, label } },
        create: {
          borrowerId,
          label,
          revenue30d: usdc6(dec(payer.revenue)),
          requests30d: payer.requests,
          sharePct: Math.round(share * 100) / 100,
          firstSeenAt: payer.firstSeenAt,
          excluded: payer.excluded,
          exclusionReason: payer.exclusionReason,
        },
        update: {
          revenue30d: usdc6(dec(payer.revenue)),
          requests30d: payer.requests,
          sharePct: Math.round(share * 100) / 100,
          excluded: payer.excluded,
          exclusionReason: payer.exclusionReason,
        },
      });
    }

    return {
      largestPayerPct: Math.round(largestPayerPct * 100) / 100,
      hhi: Math.round(hhi),
      uniquePayers: included.length,
      // A payer that settled on more than one day in the window has come back.
      // Counted from days rather than requests: a single batch of a thousand
      // requests is one customer visit, not a thousand.
      repeatPayers: included.filter(([, payer]) => payer.days.size > 1).length,
    };
  }

  /**
   * Rebuilds the window from the days and payers on file.
   *
   * Derived, never accepted from the caller. Every underwriting input the
   * protocol acts on is computed here from observations it stored itself.
   */
  private async recomputeWindow(
    tx: Prisma.TransactionClient,
    borrowerId: string,
  ): Promise<void> {
    const days = await tx.revenueDay.findMany({
      where: { borrowerId },
      orderBy: { date: 'desc' },
      take: WINDOW_DAYS * 2,
      select: { id: true, date: true, settled: true, excluded: true },
    });

    const window = days.slice(0, WINDOW_DAYS);
    const prior = days.slice(WINDOW_DAYS, WINDOW_DAYS * 2);

    const gross = window.reduce((sum, day) => sum + toNumber(day.settled), 0);
    const excludedTotal = window.reduce((sum, day) => sum + toNumber(day.excluded), 0);
    const eligible = Math.max(0, gross - excludedTotal);

    const priorGross = prior.reduce((sum, day) => sum + toNumber(day.settled), 0);
    // Growth against the preceding window of equal length. Undefined without
    // one, and reported as flat rather than as infinite.
    const growthPct =
      priorGross > 0 ? Math.round(((gross - priorGross) / priorGross) * 1000) / 10 : 0;

    const rollup = await this.rebuildPayerSummaries(tx, borrowerId, window);

    await tx.revenueWindow.update({
      where: { borrowerId },
      data: {
        gross: usdc6(dec(gross)),
        excluded: usdc6(dec(excludedTotal)),
        eligible: usdc6(dec(eligible)),
        dailyMean: usdc6(dec(window.length > 0 ? eligible / window.length : 0)),
        growthPct,
        largestPayerPct: rollup.largestPayerPct,
        // Herfindahl over percentage shares, so it lands on the 0–10,000 scale
        // the concentration bands are defined against.
        hhi: rollup.hhi,
        uniquePayers: rollup.uniquePayers,
        repeatPayers: rollup.repeatPayers,
        ...(window.length > 0
          ? {
              windowStart: window[window.length - 1]!.date,
              windowEnd: window[0]!.date,
            }
          : {}),
      },
    });
  }
}
