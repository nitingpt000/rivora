import { RATE_MODEL, TIER_PREMIUM } from './constants';
import type { Tier } from './types';

/**
 * Vault utilization. PRD §15.1.
 *
 * Note the denominator is available liquidity *plus* outstanding principal,
 * not total assets — they coincide only when nothing has been lost.
 */
export function utilization(outstandingPrincipal: number, availableLiquidity: number): number {
  const total = availableLiquidity + outstandingPrincipal;
  if (total <= 0) return 0;
  return outstandingPrincipal / total;
}

/**
 * The kinked utilization curve, in percent. PRD §15.2.
 *
 * Below the kink the rate rises gently; above it the high slope makes the last
 * points of utilization expensive, which is what protects withdrawal liquidity.
 */
export function baseRate(u: number): number {
  const { base, kink, slopeLow, slopeHigh } = RATE_MODEL;
  if (u <= kink) return base + slopeLow * u;
  return base + slopeLow * kink + slopeHigh * (u - kink);
}

/** The borrower's all-in rate: the vault rate plus the tier premium. PRD §15.3. */
export function borrowerRate(u: number, tier: Tier): number {
  return baseRate(u) + TIER_PREMIUM[tier];
}

/** Interest accrued over a number of days at an annual percentage rate. */
export function interestForDays(principal: number, annualPct: number, dayCount: number): number {
  return (principal * (annualPct / 100) * dayCount) / 365;
}

/** One day of interest at the given rate. */
export function dailyInterest(owed: number, annualPct: number): number {
  return interestForDays(owed, annualPct, 1);
}

/**
 * Advances a borrow index by one period.
 *
 * Debt is stored normalized and multiplied by the index on read, so interest
 * accrues for every borrower without iterating over them. PRD §15.4.
 */
export function advanceBorrowIndex(index: number, annualPct: number, seconds: number): number {
  const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
  return index * (1 + (annualPct / 100) * (seconds / SECONDS_PER_YEAR));
}
