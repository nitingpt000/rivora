import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AssessmentService } from '../assessment/assessment.service';
import { dec, toNumber, usdc6 } from '../common/decimal';
import { attributionStats, type AttributionStats } from './attribution';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { DetectionService } from '../risk/detection.service';
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
    private readonly detection: DetectionService,
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

    const { replaced, eligibleBefore, hhiBefore, successBefore } = await this.ledger.run(async (tx) => {
      const existing = await tx.revenueDay.findUnique({
        where: { borrowerId_date: { borrowerId: borrower.id, date } },
        select: { id: true },
      });

      const before = await tx.revenueWindow.findUnique({
        where: { borrowerId: borrower.id },
        select: { eligible: true, hhi: true },
      });
      // Captured before `recomputeHealth` overwrites it — the detector
      // compares the two, so reading it afterwards would compare a value
      // with itself.
      const healthBefore = await tx.serviceHealth.findUnique({
        where: { borrowerId: borrower.id },
        select: { successPct: true },
      });

      const day = await tx.revenueDay.upsert({
        where: { borrowerId_date: { borrowerId: borrower.id, date } },
        create: {
          borrowerId: borrower.id,
          date,
          settled: usdc6(dec(input.settled)),
          excluded: usdc6(dec(excluded)),
          requests: input.requests,
          failedRequests: input.failed ?? null,
          refunded: input.refunded === undefined ? null : usdc6(dec(input.refunded)),
        },
        // A corrected batch replaces the earlier reading. Adding to it would
        // double-count a retry, and a retry is the normal case for an indexer.
        update: {
          settled: usdc6(dec(input.settled)),
          excluded: usdc6(dec(excluded)),
          requests: input.requests,
          failedRequests: input.failed ?? null,
          refunded: input.refunded === undefined ? null : usdc6(dec(input.refunded)),
        },
        select: { id: true },
      });

      // Replace the day's breakdown wholesale, for the same reason the day
      // itself is replaced: a correction is a new reading, not an addition.
      // That includes replacing it with nothing — a correction that carries
      // no payers says the day has no attribution, and leaving the old rows
      // under a new settled figure would attach one reading's breakdown to
      // another reading's total.
      await tx.revenueDayPayer.deleteMany({ where: { revenueDayId: day.id } });
      if (payers.length > 0) {
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

      return {
        replaced: existing !== null,
        eligibleBefore: toNumber(before?.eligible ?? 0),
        hhiBefore: before?.hhi ?? 0,
        successBefore: healthBefore?.successPct ?? 0,
      };
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

    /**
     * Detection runs last, and after the assessment.
     *
     * A restriction withdraws the limit an assessment may have just set; if
     * the order were reversed the assessment would hand it straight back. A
     * detector that throws must not reject observed settlement either — the
     * revenue is a fact regardless of what was concluded from it.
     */
    try {
      await this.detection.evaluate(borrower.id, {
        eligible: eligibleBefore,
        hhi: hhiBefore,
        successPct: successBefore,
      });
    } catch (cause) {
      this.logger.error(`detection failed for ${borrower.handle}: ${String(cause)}`);
    }

    return this.result(input, excluded, replaced, eligibleAfter, material);
  }

  /**
   * Adds one settled payment to today's revenue.
   *
   * The batch path above *replaces* a day, because a re-posted batch from an
   * indexer is a corrected reading. A live payment is the opposite: it is
   * one more event on a day still in progress, so this increments. Two write
   * paths with opposite semantics is the correct answer here — collapsing
   * them would make either a retried batch double-count or a second payment
   * erase the first.
   *
   * The payer label is a pseudonym derived from the address. The wallet
   * itself stays in `X402Payment` and never reaches a revenue surface
   * (PRD §21).
   */
  async recordPayment(input: {
    borrowerId: string;
    handle: string;
    label: string;
    amount: number;
    at: Date;
  }): Promise<void> {
    const date = new Date(`${input.at.toISOString().slice(0, 10)}T00:00:00.000Z`);

    await this.ledger.run(async (tx) => {
      const day = await tx.revenueDay.upsert({
        where: { borrowerId_date: { borrowerId: input.borrowerId, date } },
        create: {
          borrowerId: input.borrowerId,
          date,
          settled: usdc6(dec(input.amount)),
          requests: 1,
        },
        update: {
          settled: { increment: usdc6(dec(input.amount)) },
          requests: { increment: 1 },
        },
        select: { id: true },
      });

      await tx.revenueDayPayer.upsert({
        where: { revenueDayId_label: { revenueDayId: day.id, label: input.label } },
        create: {
          revenueDayId: day.id,
          label: input.label,
          amount: usdc6(dec(input.amount)),
          requests: 1,
        },
        update: {
          amount: { increment: usdc6(dec(input.amount)) },
          requests: { increment: 1 },
        },
      });

      await this.recomputeWindow(tx, input.borrowerId);
    });
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
   * Derives reliability from what was observed, rather than trusting a fixture.
   *
   * `successPct` and `refundRatePct` feed the score through factor S — and
   * were never written by any runtime path, so the protocol was underwriting
   * a service whose failures it could not see. They are computed here from
   * the same window the revenue is.
   *
   * A window that reports no failures at all leaves the stored values alone.
   * Absence of data is not evidence of perfection: an indexer that has not
   * started sending failure counts should not silently promote every borrower
   * to 100% reliable.
   */
  private async recomputeHealth(
    tx: Prisma.TransactionClient,
    borrowerId: string,
    window: Array<{
      requests: number;
      failedRequests: number | null;
      settled: unknown;
      refunded: unknown;
    }>,
  ): Promise<void> {
    // Only days that reported. A day that said nothing about failures is
    // silent, not clean, and averaging it in as zero is how an unreliable
    // service scores well.
    const reported = window.filter((day) => day.failedRequests !== null);
    const refundReported = window.filter((day) => day.refunded !== null);

    if (reported.length === 0) return;

    const fulfilled = reported.reduce((sum, day) => sum + day.requests, 0);
    const failed = reported.reduce((sum, day) => sum + (day.failedRequests ?? 0), 0);
    const attempted = fulfilled + failed;
    if (attempted === 0) return;

    const settled = refundReported.reduce((sum, day) => sum + toNumber(day.settled as never), 0);
    const refunded = refundReported.reduce((sum, day) => sum + toNumber(day.refunded as never), 0);

    await tx.serviceHealth.update({
      where: { borrowerId },
      data: {
        successPct: Math.round((fulfilled / attempted) * 1000) / 10,
        // Left alone when no day reported a refund figure, for the same
        // reason: silence is not zero.
        ...(refundReported.length > 0 && settled > 0
          ? { refundRatePct: Math.round((refunded / settled) * 1000) / 10 }
          : {}),
      },
    });
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
    eligible: number,
  ): Promise<AttributionStats> {
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

    /**
     * The stats are computed over eligible revenue, not merely the
     * attributed subset — the unattributed remainder rides along as one
     * presumed payer. See `attribution.ts` for why the presumption is
     * concentration, not innocence.
     */
    const stats = attributionStats(
      [...byLabel.values()].map((payer) => ({
        revenue: payer.revenue,
        daysActive: payer.days.size,
        excluded: payer.excluded,
      })),
      eligible,
    );

    // Rows for payers no longer in the window are removed, not left stale.
    await tx.payerSummary.deleteMany({
      where: { borrowerId, label: { notIn: [...byLabel.keys()] } },
    });

    for (const [label, payer] of byLabel) {
      const share =
        stats.shareBase > 0 && !payer.excluded ? (payer.revenue / stats.shareBase) * 100 : 0;

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

    return stats;
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
      select: {
        id: true,
        date: true,
        settled: true,
        excluded: true,
        requests: true,
        failedRequests: true,
        refunded: true,
      },
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

    const rollup = await this.rebuildPayerSummaries(tx, borrowerId, window, eligible);
    await this.recomputeHealth(tx, borrowerId, window);

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
        attributedPct: rollup.attributedPct,
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
