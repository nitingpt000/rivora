import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  calculateLimit,
  coefficientOfVariation,
  compositeScore,
  factorPenalties,
  normalizeRevenue,
  qualityFactor,
  scoreComponents,
  tierForScore,
  type ScoreComponent,
  type ScoreSignals,
} from '@rivora/core';

import { dec, toNumber, usdc6 } from '../common/decimal';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

/** Settlement days between scheduled assessments. PRD §16.6. */
export const ASSESSMENT_INTERVAL_DAYS = 14;

/** Days of settled revenue behind the underwriting window. */
const WINDOW_DAYS = 30;

const MODEL_VERSION = 'riv-uw-2.1';

type BorrowerGraph = Prisma.BorrowerGetPayload<{
  include: { creditLine: true; revenueWindow: true; health: true };
}>;

/** Everything one assessment concluded, before anything is written down. */
export interface AssessmentResult {
  score: number;
  previousScore: number;
  tier: string;
  limit: number;
  previousLimit: number;
  bindingKey: string;
  ladder: unknown[];
  penalties: ReturnType<typeof factorPenalties>;
  components: ScoreComponent[];
  quality: number;
  model: string;
  assessedAt: string;
}

/**
 * The underwriter.
 *
 * One computation, used by both the screen that explains a limit and the job
 * that writes it. They were separate before: the endpoint recomputed for
 * display while the stored limit only ever came from the seed, so the number a
 * borrower read and the number the protocol enforced could drift apart with
 * nothing to reconcile them.
 *
 * `compute` decides. `reassess` decides and records. Nothing else may set a
 * credit limit.
 */
@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * What the ladder says today, from live inputs.
   *
   * Recomputed rather than read back, because the credit screen's promise is
   * that it explains *today's* position — a borrower who improved their
   * concentration yesterday should see the rung move before the next
   * scheduled assessment moves the limit.
   */
  async compute(
    borrower: BorrowerGraph,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<AssessmentResult> {
    const credit = borrower.creditLine!;
    const revenue = borrower.revenueWindow!;
    const health = borrower.health!;

    const [vault, defaults, days] = await Promise.all([
      client.vaultState.findUnique({ where: { id: 'singleton' } }),
      client.defaultRecord.count({ where: { borrowerId: borrower.id } }),
      client.revenueDay.findMany({
        where: { borrowerId: borrower.id },
        orderBy: { date: 'desc' },
        take: WINDOW_DAYS,
        select: { settled: true, excluded: true },
      }),
    ]);

    // Oldest first, and net of exclusions: the base the limit is derived from
    // is eligible revenue, not gross.
    const series = [...days]
      .reverse()
      .map((row) => Math.max(0, toNumber(row.settled) - toNumber(row.excluded)));
    const reserveTarget = toNumber(credit.reserveTarget);
    const cycles = credit.completedCycles;

    const signals: ScoreSignals = {
      uptimePct: health.uptimePct,
      successPct: health.successPct,
      revenueCv: coefficientOfVariation(series),
      // A default counts against the record permanently, whether or not it
      // was later cured.
      onTimeRatioPct: cycles > 0 ? Math.max(0, ((cycles - defaults) / cycles) * 100) : 100,
      completedCycles: cycles,
      largestPayerPct: revenue.largestPayerPct,
      hhi: revenue.hhi,
      uniquePayers: revenue.uniquePayers,
      custody: borrower.custody,
      historyDays: credit.historyDays,
      growthPct: revenue.growthPct,
      reserveCoveragePct:
        reserveTarget > 0 ? (toNumber(credit.reserve) / reserveTarget) * 100 : 100,
    };

    // The score and the tier are derived from the same signals as the
    // components that explain them, so the breakdown always sums to the score.
    const score = compositeScore(signals);
    const tier = tierForScore(score);

    const factors = {
      S: health.factorS,
      C: health.factorC,
      V: health.factorV,
      D: health.factorD,
      M: health.factorM,
      G: health.factorG,
    };

    /**
     * The normalised base, not the raw window total. PRD §13.2.
     *
     * Time-weighted and clamped against the median, which is what stops a
     * burst of manufactured days from driving the limit — genuine growth lifts
     * the mean and the median together, so the clamp does not bind on it.
     *
     * `normalizeRevenue` existed and was tested from the start; nothing called
     * it, and the parameter named `normalizedRevenue30d` was being handed a
     * raw sum. A single outsized day moved the limit exactly as §13.2 says it
     * would if this were skipped.
     */
    const normalized = series.length > 0 ? normalizeRevenue(series) : toNumber(revenue.eligible);

    const decision = calculateLimit({
      normalizedRevenue30d: normalized,
      // The tier the score produces now, not the one on file — otherwise a
      // borrower who has improved is underwritten against their old band.
      tier,
      factors,
      custody: borrower.custody,
      repaymentBps: credit.repaymentBps,
      previousLimit: toNumber(credit.limitAmount),
      vaultAssets: toNumber(vault?.totalAssets ?? 0),
      historyDays: credit.historyDays,
      completedCycles: cycles,
    });

    return {
      score,
      previousScore: credit.score,
      tier,
      limit: decision.limit,
      previousLimit: toNumber(credit.limitAmount),
      bindingKey: decision.bindingKey,
      ladder: decision.ladder as unknown[],
      penalties: factorPenalties(factors),
      components: scoreComponents(signals),
      quality: qualityFactor(factors),
      model: MODEL_VERSION,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Runs an assessment and makes it the borrower's position.
   *
   * Writes the `Assessment` row first: the record of what was decided has to
   * survive even if the credit line update is rolled back, or a limit could
   * move with nothing explaining why.
   *
   * A borrower in OBSERVATION stays there — clearing the observation window is
   * a separate gate, and an assessment must not smuggle a borrower past it.
   */
  async reassess(borrowerId: string, trigger: string): Promise<AssessmentResult> {
    return this.ledger.run(async (tx) => {
      const borrower = await tx.borrower.findUnique({
        where: { id: borrowerId },
        include: { creditLine: true, revenueWindow: true, health: true },
      });

      if (!borrower?.creditLine || !borrower.revenueWindow || !borrower.health) {
        throw new Error(`Borrower ${borrowerId} is not underwritable.`);
      }

      const credit = borrower.creditLine;
      const result = await this.compute(borrower, tx);

      const vault = await tx.vaultState.findUnique({ where: { id: 'singleton' } });

      await tx.assessment.create({
        data: {
          borrowerId: borrower.id,
          atDay: vault?.day ?? 0,
          score: result.score,
          tier: result.tier as never,
          limitAmount: usdc6(dec(result.limit)),
          previousLimit: usdc6(dec(result.previousLimit)),
          bindingKey: result.bindingKey,
          ladder: result.ladder as never,
          model: result.model,
        },
      });

      // A restricted or defaulted borrower keeps the limit their status
      // imposed. Recomputing one for them would hand credit back to exactly
      // the borrower a risk decision just took it from.
      const enforced = credit.status === 'ACTIVE' || credit.status === 'REPAID';

      await tx.creditLine.update({
        where: { id: credit.id },
        data: {
          score: result.score,
          previousScore: result.previousScore,
          tier: result.tier as never,
          ...(enforced
            ? {
                limitAmount: usdc6(dec(result.limit)),
                previousLimit: usdc6(dec(result.previousLimit)),
              }
            : {}),
        },
      });

      const delta = result.limit - result.previousLimit;
      const txHash = await this.ledger.nextTxHash(tx);

      await this.ledger.recordEvent(tx, {
        type: 'credit.assessed',
        who: borrower.handle,
        amount: `${result.limit.toFixed(2)} USDC`,
        txHash,
        note: `${trigger} · score ${result.previousScore} → ${result.score} · ${result.bindingKey}`,
        borrowerId: borrower.id,
      });

      // Only worth a notification when something the borrower would act on
      // actually moved. A reassessment that confirms the status quo is noise.
      if (enforced && Math.abs(delta) >= 0.01) {
        await this.ledger.recordAlert(tx, {
          icon: delta > 0 ? '▲' : '▼',
          title: `Credit limit ${delta > 0 ? 'raised' : 'reduced'} to ${result.limit.toFixed(2)} USDC`,
          body: `Bound by ${result.bindingKey}. Score ${result.previousScore} → ${result.score}.`,
          borrowerId: borrower.id,
        });
      }

      this.logger.log(
        `assessed ${borrower.handle}: limit ${result.previousLimit.toFixed(2)} → ${result.limit.toFixed(2)} (${trigger})`,
      );

      return result;
    });
  }

  /**
   * Borrowers whose last assessment has aged past the interval.
   *
   * Measured in settlement days, so the cadence tracks observed revenue rather
   * than the calendar. A borrower who has never been assessed is due
   * immediately — that is the first approval, and waiting out the interval to
   * grant it would mean the observation window ran twice.
   */
  async dueForReassessment(currentDay: number): Promise<string[]> {
    const borrowers = await this.prisma.borrower.findMany({
      select: {
        id: true,
        assessments: { orderBy: { at: 'desc' }, take: 1, select: { atDay: true } },
      },
    });

    return borrowers
      .filter((borrower) => {
        const last = borrower.assessments[0]?.atDay;
        return last === undefined || currentDay - last >= ASSESSMENT_INTERVAL_DAYS;
      })
      .map((borrower) => borrower.id);
  }
}
