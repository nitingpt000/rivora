import { COVERAGE } from './constants';
import { dailyInterest } from './rates';
import type { RepaymentApplication, WaterfallSplit } from './types';

/**
 * The revenue waterfall. PRD §12.2.
 *
 * The invariant the acceptance criteria care about (§22.5) is that the split
 * sums exactly to the gross: the operating share is computed as a remainder,
 * never as its own percentage, so rounding can never mint or lose a unit.
 */
export function splitRevenue(
  gross: number,
  repaymentBps: number,
  reserveBps: number,
  opts: { hasDebt: boolean; reserveAtTarget: boolean } = { hasDebt: true, reserveAtTarget: false },
): WaterfallSplit {
  const effectiveRepaymentBps = opts.hasDebt ? repaymentBps : 0;
  const effectiveReserveBps = opts.reserveAtTarget ? 0 : reserveBps;

  const toRepayment = round2((gross * effectiveRepaymentBps) / 10_000);
  const toReserve = round2((gross * effectiveReserveBps) / 10_000);
  const toOperating = round2(gross - toRepayment - toReserve);

  return { gross, toRepayment, toReserve, toOperating };
}

/**
 * Applies a repayment: accrued interest first, then principal, then any excess
 * returns to the borrower. PRD §12.4 / §22.5.
 */
export function applyRepayment(
  amount: number,
  principal: number,
  accruedInterest: number,
): RepaymentApplication {
  const toInterest = Math.min(amount, accruedInterest);
  const toPrincipal = Math.min(amount - toInterest, principal);
  const excess = round2(amount - toInterest - toPrincipal);

  return {
    amount,
    toInterest: round2(toInterest),
    toPrincipal: round2(toPrincipal),
    excess,
    clearsDebt: principal - toPrincipal < 0.005 && accruedInterest - toInterest < 0.005,
  };
}

/** Daily repayment capacity from routed revenue. */
export function dailyRepaymentCapacity(dailyRevenue: number, repaymentBps: number): number {
  return (dailyRevenue * repaymentBps) / 10_000;
}

/**
 * Interest coverage. PRD §15.5.
 *
 * Under default parameters this sits around 50 and negative amortization from
 * the rate alone is unreachable. The condition it actually catches is revenue
 * collapse against unchanged principal — which is precisely what a revenue-share
 * mechanism hides, because a borrower earning almost nothing is still
 * "repaying on schedule" as a percentage.
 */
export function interestCoverage(
  dailyRevenue: number,
  repaymentBps: number,
  owed: number,
  annualRatePct: number,
): number {
  const accrual = dailyInterest(owed, annualRatePct);
  if (accrual <= 0) return Infinity;
  return dailyRepaymentCapacity(dailyRevenue, repaymentBps) / accrual;
}

export type CoverageState = 'healthy' | 'thin' | 'impaired' | 'negative-amortizing';

export function coverageState(coverage: number): CoverageState {
  if (coverage >= COVERAGE.minInterestCoverageForDraw) return 'healthy';
  if (coverage >= COVERAGE.watchInterestCoverage) return 'thin';
  if (coverage >= COVERAGE.criticalInterestCoverage) return 'impaired';
  return 'negative-amortizing';
}

/** Days to clear the debt at the current routed repayment rate. PRD §13.4. */
export function projectedPayback(
  owed: number,
  dailyRevenue: number,
  repaymentBps: number,
): number | null {
  const perDay = dailyRepaymentCapacity(dailyRevenue, repaymentBps);
  if (owed <= 0) return 0;
  if (perDay <= 0) return null;
  return Math.ceil(owed / perDay);
}

/** The same projection after a revenue shock. PRD §13.4. */
export function stressedPayback(
  owed: number,
  dailyRevenue: number,
  repaymentBps: number,
  stressFactor = 0.7,
): number | null {
  return projectedPayback(owed, dailyRevenue * stressFactor, repaymentBps);
}

/**
 * Routed-revenue coverage ratio. PRD §11.5.
 *
 * The endpoint probe detects a changed `payTo`. This detects a second,
 * unregistered endpoint serving the same service — revenue that exists but
 * never arrives.
 */
export function routedCoverageRatio(actualRouted: number, expectedRouted: number): number {
  if (expectedRouted <= 0) return 1;
  return actualRouted / expectedRouted;
}

export type RoutedCoverageState = 'consistent' | 'minor' | 'material' | 'diversion';

export function routedCoverageState(ratio: number): RoutedCoverageState {
  if (ratio >= 0.95) return 'consistent';
  if (ratio >= COVERAGE.routedReview) return 'minor';
  if (ratio >= COVERAGE.routedDiversion) return 'material';
  return 'diversion';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
