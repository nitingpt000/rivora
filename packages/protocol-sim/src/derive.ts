import {
  TIER_PREMIUM,
  availableCredit,
  baseRate,
  borrowerRate,
  bufferRatio,
  calculateLimit,
  canBorrow,
  concentrationBand,
  factorPenalties,
  interestCoverage,
  projectedPayback,
  qualityFactor,
  routedCoverageState,
  stressedPayback,
  utilization,
} from '@rivora/core';
import type { Constraint, FactorPenalty, Tier } from '@rivora/core';

import type { SimState } from './state';

/**
 * Everything the screens read that is computed rather than stored.
 *
 * Kept as one pure function of state so the borrower dashboard, the credit
 * screen, the draw modal and the risk console cannot disagree about what the
 * borrower's rate or coverage is — a real hazard when four surfaces each
 * recompute from raw fields.
 */
export interface Derived {
  utilization: number;
  baseRatePct: number;
  borrowerRatePct: number;
  premiumPct: number;
  owed: number;
  available: number;
  drawnRatio: number;
  dailyRepayment: number;
  interestCoverage: number;
  paybackDays: number | null;
  stressedPaybackDays: number | null;
  bufferPct: number;
  reserveCoverageRatio: number;
  quality: number;
  penalties: FactorPenalty[];
  ladder: Constraint[];
  bindingKey: string;
  recomputedLimit: number;
  concentrationBand: ReturnType<typeof concentrationBand>;
  routedState: ReturnType<typeof routedCoverageState>;
  expectedRouted: number;
  canBorrow: boolean;
  hasDebt: boolean;
  lpValue: number;
  lpEarned: number;
  outstandingProtocolWide: number;
  scoreDelta: number;
}

/**
 * Protocol-wide outstanding principal.
 *
 * The seeded book is 8,470 across seven borrowers, of which our borrower holds
 * 2,000. When they draw or repay, the book moves with them — otherwise
 * utilization on the LP screen would not respond to borrower actions, and the
 * two surfaces would tell contradictory stories.
 */
function protocolOutstanding(s: SimState): number {
  const SEEDED_BOOK = 8_470;
  const SEEDED_OWN_PRINCIPAL = 2_000;
  return SEEDED_BOOK + (s.principal - SEEDED_OWN_PRINCIPAL);
}

/**
 * Memoised by state identity.
 *
 * Zustand v5 reads the store through `useSyncExternalStore`, which compares
 * snapshots by reference. A selector that builds a fresh object on every call
 * therefore re-renders forever. The store's state object only changes identity
 * on `set()`, so caching against it is both correct and free.
 */
const cache = new WeakMap<SimState, Derived>();

export function derive(s: SimState): Derived {
  const hit = cache.get(s);
  if (hit) return hit;
  const value = computeDerived(s);
  cache.set(s, value);
  return value;
}

function computeDerived(s: SimState): Derived {
  const outstanding = protocolOutstanding(s);
  const u = utilization(outstanding, s.vaultLiquidity);
  const base = baseRate(u);
  const rate = borrowerRate(u, s.tier);
  const owed = s.principal + s.accruedInterest;
  const available = availableCredit(s.limit, s.principal, s.pendingDraws);
  const dailyRepayment = (s.dailyRevenue * s.repaymentBps) / 10_000;

  const decision = calculateLimit({
    normalizedRevenue30d: s.eligibleRevenue,
    tier: s.tier,
    factors: s.factors,
    custody: 'A',
    repaymentBps: s.repaymentBps,
    previousLimit: s.previousLimit,
    vaultAssets: s.vaultAssets,
    historyDays: s.historyDays,
    completedCycles: s.completedCycles,
  });

  const lpValue = s.lpShares * s.sharePrice;

  return {
    utilization: u,
    baseRatePct: base,
    borrowerRatePct: rate,
    premiumPct: TIER_PREMIUM[s.tier as Tier],
    owed,
    available,
    drawnRatio: s.limit > 0 ? s.principal / s.limit : 0,
    dailyRepayment,
    interestCoverage: interestCoverage(s.dailyRevenue, s.repaymentBps, owed, rate),
    paybackDays: projectedPayback(owed, s.dailyRevenue, s.repaymentBps),
    stressedPaybackDays: stressedPayback(owed, s.dailyRevenue, s.repaymentBps),
    bufferPct: bufferRatio(s.vaultLiquidity, s.vaultAssets) * 100,
    reserveCoverageRatio: s.reserveTarget > 0 ? s.reserve / s.reserveTarget : 0,
    quality: qualityFactor(s.factors),
    penalties: factorPenalties(s.factors),
    ladder: decision.ladder,
    bindingKey: decision.bindingKey,
    recomputedLimit: decision.limit,
    concentrationBand: concentrationBand(s.hhi),
    routedState: routedCoverageState(s.coverageRatio),
    expectedRouted: s.coverageRatio > 0 ? s.eligibleRevenue / s.coverageRatio : s.eligibleRevenue,
    canBorrow: canBorrow(s.status, available),
    hasDebt: owed > 0.005,
    lpValue,
    lpEarned: Math.max(0, lpValue - s.lpSupplied),
    outstandingProtocolWide: outstanding,
    scoreDelta: s.score - s.previousScore,
  };
}
