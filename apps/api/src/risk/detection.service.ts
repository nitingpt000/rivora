import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { dec, toNumber, usdc6 } from '../common/decimal';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { detect, severest, type DetectionSignals, type Finding } from './detection';

/** Repayment share a restricted borrower routes. PRD §35.3. */
const ESCALATED_REPAYMENT_BPS = 3_500;

/** Exclusion reasons that count as the borrower funding their own revenue. */
const CIRCULAR_REASONS = /circular|related|self|wash/i;

/**
 * The protocol noticing, and acting.
 *
 * Runs after every revenue ingestion. Detection is automatic and the
 * protective action is automatic with it; **lifting** a restriction is not —
 * that takes a risk operator. The asymmetry is deliberate. Protecting the
 * book from a borrower inflating their own revenue should not wait for
 * somebody to be awake, and releasing a borrower from that judgement should
 * never happen because a number drifted back over a line.
 *
 * This is what PRD §35.3 describes and what nothing implemented: the
 * anomaly was a seeded row, and no runtime path could set any status other
 * than DEFAULTED.
 */
@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Evaluates a borrower against what their window now says.
   *
   * Returns the finding that was acted on, or null. Called outside the
   * ingestion transaction: acting on the window this write produced means
   * reading it after it commits.
   */
  async evaluate(
    borrowerId: string,
    prior: { eligible: number; hhi: number; successPct: number },
  ): Promise<Finding | null> {
    const borrower = await this.prisma.borrower.findUnique({
      where: { id: borrowerId },
      include: { creditLine: true, revenueWindow: true, health: true },
    });

    if (!borrower?.creditLine || !borrower.revenueWindow || !borrower.health) return null;

    // A borrower already in the worst state is not re-restricted. The record
    // stands; repeating it would bury the original finding under duplicates.
    const status = borrower.creditLine.status;
    if (status === 'DEFAULTED' || status === 'RESTRICTED') return null;

    const wash = await this.washActivity(borrowerId);
    const window = borrower.revenueWindow;

    const signals: DetectionSignals = {
      eligible: toNumber(window.eligible),
      priorEligible: prior.eligible,
      hhi: window.hhi,
      priorHhi: prior.hhi,
      largestPayerPct: window.largestPayerPct,
      gross: toNumber(window.gross),
      successPct: borrower.health.successPct,
      priorSuccessPct: prior.successPct,
      ...wash,
    };

    const finding = severest(detect(signals));
    if (!finding) return null;

    if (finding.action === 'restrict') {
      await this.restrict(borrower.id, borrower.handle, finding, signals);
    } else {
      await this.watch(borrower.id, borrower.handle, finding);
    }

    return finding;
  }

  /**
   * Circular activity in the window, from the payer grain.
   *
   * The indexer marks a payer excluded and says why; this counts what those
   * exclusions add up to. The protocol is not re-deciding whether a wallet is
   * related — it is deciding whether the amount involved is a borrower-level
   * fact rather than a customer-level one.
   */
  private async washActivity(
    borrowerId: string,
  ): Promise<{ washAmount: number; washPayers: number; washDays: number }> {
    const rows = await this.prisma.revenueDayPayer.findMany({
      where: { revenueDay: { borrowerId }, excluded: true },
      select: { label: true, amount: true, exclusionReason: true, revenueDay: { select: { date: true } } },
    });

    const circular = rows.filter((row) => CIRCULAR_REASONS.test(row.exclusionReason ?? ''));

    return {
      washAmount: circular.reduce((sum, row) => sum + toNumber(row.amount), 0),
      washPayers: new Set(circular.map((row) => row.label)).size,
      washDays: new Set(circular.map((row) => row.revenueDay.date.toISOString())).size,
    };
  }

  /**
   * Withdraws the limit, escalates the repayment share, and writes the
   * permanent record of why. The outstanding balance is untouched — a
   * restricted borrower keeps repaying, faster.
   */
  private async restrict(
    borrowerId: string,
    handle: string,
    finding: Finding,
    signals: DetectionSignals,
  ): Promise<void> {
    await this.ledger.run(async (tx) => {
      const credit = await tx.creditLine.findUnique({ where: { borrowerId } });
      if (!credit) return;

      await tx.creditLine.update({
        where: { id: credit.id },
        data: {
          limitAmount: usdc6(dec(0)),
          previousLimit: credit.limitAmount,
          repaymentBps: ESCALATED_REPAYMENT_BPS,
          status: 'RESTRICTED',
          restrictReason: 'circular',
          anomalyDetected: true,
        },
      });

      await this.recordAnomaly(tx, borrowerId, handle, finding, signals, credit);

      await this.ledger.recordAlert(tx, {
        icon: '⛔',
        title: 'Credit withdrawn — manufactured revenue detected',
        body: `${finding.reason}. New draws are blocked and the repayment share is now ${ESCALATED_REPAYMENT_BPS / 100}%. The outstanding balance continues to repay from routed revenue.`,
        borrowerId,
      });
    });

    this.logger.warn(`restricted ${handle}: ${finding.reason}`);
  }

  /** Freezes new draws without withdrawing the limit. */
  private async watch(borrowerId: string, handle: string, finding: Finding): Promise<void> {
    await this.ledger.run(async (tx) => {
      const credit = await tx.creditLine.findUnique({ where: { borrowerId } });
      if (!credit) return;

      await tx.creditLine.update({
        where: { id: credit.id },
        data: {
          status: 'WATCH',
          // `revenue` covers both a collapse and the failures that precede
          // one; the schema enumerates two reasons and a failure rate is the
          // revenue story arriving early.
          watchReason: finding.kind === 'concentration' ? 'concentration' : 'revenue',
        },
      });

      await this.ledger.recordAlert(tx, {
        icon: '⚠',
        title: 'New draws frozen — under review',
        body: `${finding.reason}. The existing balance is unaffected and repayment continues as before.`,
        borrowerId,
      });
    });

    this.logger.warn(`watching ${handle}: ${finding.reason}`);
  }

  /**
   * The evidence bundle behind a restriction.
   *
   * `netEconomicRevenue` stays null: proving the activity cost more in gas
   * than it returned needs the payers' own transaction costs, which the
   * protocol cannot see. Recording a zero there would assert something never
   * measured, and this record exists to be argued with.
   */
  private async recordAnomaly(
    tx: Prisma.TransactionClient,
    borrowerId: string,
    handle: string,
    finding: Finding,
    signals: DetectionSignals,
    credit: { score: number; tier: string },
  ): Promise<void> {
    const count = await tx.anomaly.count();
    const txHash = await this.ledger.nextTxHash(tx);

    await tx.anomaly.create({
      data: {
        reference: `A-${String(count + 1).padStart(4, '0')}`,
        borrowerId,
        kind: 'Circular funding',
        washAmount: usdc6(dec(signals.washAmount)),
        payerCount: signals.washPayers,
        daysSpanned: signals.washDays,
        netEconomicRevenue: null,
        evidenceHash: txHash,
        txHash,
        evidence: [
          {
            at: new Date().toISOString(),
            note: finding.reason,
          },
          {
            at: new Date().toISOString(),
            note: `${signals.washPayers} payers excluded as circular across ${signals.washDays} settled days`,
          },
        ] as Prisma.InputJsonValue,
        fundedWallets: [] as Prisma.InputJsonValue,
        afterEligibleRevenue: usdc6(dec(signals.eligible)),
        afterScore: credit.score,
        afterTier: credit.tier as never,
        afterLimit: usdc6(dec(0)),
        afterRepaymentBps: ESCALATED_REPAYMENT_BPS,
      },
    });

    await this.ledger.recordEvent(tx, {
      type: 'risk.anomaly.detected',
      who: handle,
      amount: `${signals.washAmount.toFixed(2)} USDC`,
      txHash,
      note: finding.reason,
      borrowerId,
    });
  }

  /**
   * Lifts a restriction. Operator-only, and deliberately not automatic.
   *
   * The limit is not restored here — it returns to zero until an assessment
   * decides what it should be, so a reinstated borrower is underwritten
   * again rather than handed back the number they had before the finding.
   */
  async reinstate(borrowerId: string, handle: string, operator: string, note: string): Promise<void> {
    await this.ledger.run(async (tx) => {
      const credit = await tx.creditLine.findUnique({ where: { borrowerId } });
      if (!credit) return;

      await tx.creditLine.update({
        where: { id: credit.id },
        data: {
          status: 'ACTIVE',
          restrictReason: '',
          watchReason: '',
          anomalyDetected: false,
          repaymentBps: 2_000,
        },
      });

      const txHash = await this.ledger.nextTxHash(tx);
      await this.ledger.recordEvent(tx, {
        type: 'risk.reinstated',
        who: handle,
        amount: '—',
        txHash,
        note: `${note} · by ${operator}`,
        borrowerId,
      });

      await this.ledger.recordAlert(tx, {
        icon: '✓',
        title: 'Restriction lifted',
        body: `${note}. The limit stays at zero until the next assessment sets it.`,
        borrowerId,
      });
    });

    this.logger.log(`reinstated ${handle} by ${operator}: ${note}`);
  }
}
