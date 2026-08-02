import type { CustodyModel, QualityFactors, Tier } from './types';

/**
 * Protocol parameters. Every number here is traceable to a PRD section — if
 * one changes, the citation is where to check what else moves with it.
 */

/** Interest-rate model. PRD §15.2. */
export const RATE_MODEL = {
  /** Base annual rate at zero utilization, percent. */
  base: 5,
  /** Utilization kink. */
  kink: 0.8,
  /** Slope below the kink, percentage points per unit of utilization. */
  slopeLow: 8,
  /** Slope above the kink. */
  slopeHigh: 80,
} as const;

/** Tier risk premiums, percentage points added to r(U). PRD §14.4. */
export const TIER_PREMIUM: Record<Tier, number> = {
  Prime: 1,
  Strong: 3,
  Standard: 6,
  Restricted: 12,
  Ineligible: 12,
};

/** Base advance rate by tier. PRD §14.4. */
export const TIER_ADVANCE_RATE: Record<Tier, number> = {
  Prime: 0.35,
  Strong: 0.3,
  Standard: 0.2,
  Restricted: 0,
  Ineligible: 0,
};

/** Maximum repayment horizon in days by tier. PRD §13.4 / §14.4. */
export const TIER_MAX_HORIZON_DAYS: Record<Tier, number> = {
  Prime: 60,
  Strong: 60,
  Standard: 45,
  Restricted: 0,
  Ineligible: 0,
};

/** Absolute limit cap by tier. PRD §14.4. */
export const TIER_LIMIT_CAP: Record<Tier, number> = {
  Prime: 100_000,
  Strong: 50_000,
  Standard: 25_000,
  Restricted: 0,
  Ineligible: 0,
};

/**
 * Advance-rate multiplier by custody model. PRD §11.3.
 *
 * A borrower on Model C is borrowing close to the value of its own posted
 * reserve, which is the intended outcome: unenforced repayment should not
 * receive unsecured credit.
 */
export const CUSTODY_MULTIPLIER: Record<CustodyModel, number> = {
  A: 1,
  B: 0.5,
  C: 0.25,
};

export const CUSTODY_LABEL: Record<CustodyModel, string> = {
  A: 'Router is the settlement destination',
  B: 'Policy-constrained Agent Wallet',
  C: 'Post-settlement sweep',
};

export const CUSTODY_ENFORCEMENT: Record<CustodyModel, string> = {
  A: 'Structural',
  B: 'Policy-enforced',
  C: 'Behavioural',
};

/** Weights of the composite quality factor. Must sum to 1. PRD §13.3. */
export const FACTOR_WEIGHTS: Record<keyof QualityFactors, number> = {
  S: 0.3,
  C: 0.25,
  V: 0.15,
  D: 0.15,
  M: 0.15,
};

export const FACTOR_LABELS: Record<keyof QualityFactors, string> = {
  S: 'Service reliability',
  C: 'Customer concentration',
  V: 'Revenue volatility',
  D: 'Revenue diversity',
  M: 'Operating capacity',
};

/** Underwriting bounds. PRD §13.3. */
export const UNDERWRITING = {
  /** Floor on the composite quality factor. */
  qMin: 0.35,
  /** Maximum limit increase per assessment. */
  growthCap: 1.5,
  /** Cap while history is shorter than `seasoningHistoryDays`. */
  newBorrowerCap: 2_500,
  newBorrowerHistoryDays: 90,
  /** Per-borrower share of total vault assets. */
  exposureCapPct: 0.05,
  /** Stress applied when checking the stressed horizon. PRD §13.4. */
  stressRevenueFactor: 0.7,
  stressMaxHorizonDays: 90,
  /** Days between settlement and eligibility for underwriting. PRD §13.2. */
  seasoningDays: 3,
  /** Decay used for the time-weighted revenue base. PRD §13.2. */
  timeWeightLambda: 0.97,
  /** Spike clamp: weighted revenue may not exceed median × this. PRD §13.2. */
  medianClampK: 1.5,

  // ── score normalisation. PRD §14.3. ──────────────────────────────────────
  /** Completed cycles at which the repayment record is taken at face value. */
  cyclesForFullConfidence: 6,
  /** Where the repayment signal sits before any cycle has completed. */
  repaymentPriorWeight: 0.5,
  /** Largest-payer share at which the concentration signal reaches zero. */
  concentrationCeilingPct: 45,
  /** HHI at which the diversity signal reaches zero. */
  hhiCeiling: 2_500,
  /** Days of operating history that earn full credit for tenure. */
  historyDaysForFullCredit: 180,
  /** 30-day growth that earns full credit; decline of the same size scores zero. */
  growthPctForFullCredit: 25,
} as const;

/** Vault liquidity management. PRD §23. */
export const VAULT = {
  /** Share of total assets that must stay liquid. */
  bufferFloorPct: 0.15,
  /** Draws are refused above this utilization. */
  maxUtilization: 0.85,
  /** Exit fee starts at this utilization … */
  feeStartUtilization: 0.8,
  /** … and reaches `feeMax` at this one. */
  feeEndUtilization: 0.95,
  feeMax: 0.01,
  /** Bootstrap yield floor and its expiry. PRD §23.7. */
  bootstrapYieldFloorPct: 6,
  /** Trailing repayment rate used to estimate queue clearance, USDC/day. */
  queueFundingRatePerDay: 186.34,
} as const;

/** Draw preconditions. PRD §15.5. */
export const COVERAGE = {
  /** Interest coverage required before any draw is permitted. */
  minInterestCoverageForDraw: 3,
  /** Below this, the borrower moves to WATCH. */
  watchInterestCoverage: 1.5,
  /** Below this the loan is negatively amortizing. */
  criticalInterestCoverage: 1,
  /** Routed-revenue coverage thresholds. PRD §11.5. */
  routedReview: 0.8,
  routedDiversion: 0.5,
} as const;

/** Hard concentration ceilings. PRD §13.7. */
export const CONCENTRATION_CEILINGS = [
  { threshold: 0.4, effect: 'limit capped at new-borrower cap' },
  { threshold: 0.6, effect: 'WATCH-tier limits only' },
  { threshold: 0.8, effect: 'no new draws' },
] as const;

/** Origination fee charged on each draw. PRD §39.2. */
export const ORIGINATION_FEE_PCT = 0.0025;

/** Default revenue-router split. PRD §12.2. */
export const DEFAULT_SPLIT = {
  repaymentBps: 2_000,
  reserveBps: 200,
} as const;

/** Repayment share applied while a borrower is restricted or delinquent. */
export const ESCALATED_REPAYMENT_BPS = 3_500;

/** Repayment share applied during cure. PRD §19.5. */
export const RECOVERY_REPAYMENT_BPS = 5_000;

/**
 * Plausible cost-per-request bands by service category, as a share of price.
 * A declared cost below the floor is rejected and `M` is capped. PRD §13.10.
 */
export const COST_BANDS: Record<string, { floor: number; ceiling: number }> = {
  'Text generation and inference proxy': { floor: 0.4, ceiling: 0.85 },
  'Embedding and vector services': { floor: 0.2, ceiling: 0.6 },
  'Search, retrieval and enrichment': { floor: 0.3, ceiling: 0.75 },
  'Document and media processing': { floor: 0.35, ceiling: 0.8 },
  'Data lookup and static datasets': { floor: 0.1, ceiling: 0.5 },
};

/** Ceilings on `M` by how well the cost base is observed. PRD §13.10. */
export const M_CEILING = {
  unverified: 0.85,
  partiallyObserved: 0.95,
  fullyObserved: 1,
} as const;

/** Score-band boundaries, evaluated high to low. PRD §14.2. */
export const SCORE_BANDS: ReadonlyArray<{ min: number; tier: Tier }> = [
  { min: 90, tier: 'Prime' },
  { min: 75, tier: 'Strong' },
  { min: 60, tier: 'Standard' },
  { min: 40, tier: 'Restricted' },
  { min: 0, tier: 'Ineligible' },
];

/** Weighted signals behind the 0–100 risk score. PRD §14.3. */
export const SCORE_WEIGHTS = [
  { key: 'reliability', label: 'Service reliability', weight: 0.2 },
  { key: 'consistency', label: 'Revenue consistency', weight: 0.18 },
  { key: 'repayment', label: 'Repayment history', weight: 0.15 },
  { key: 'concentration', label: 'Customer concentration', weight: 0.13 },
  { key: 'diversity', label: 'Customer diversity', weight: 0.1 },
  { key: 'custody', label: 'Revenue custody strength', weight: 0.08 },
  { key: 'history', label: 'Operating history', weight: 0.06 },
  { key: 'growth', label: 'Revenue growth', weight: 0.05 },
  { key: 'reserve', label: 'Reserve coverage', weight: 0.05 },
] as const;

export type ScoreSignalKey = (typeof SCORE_WEIGHTS)[number]['key'];
