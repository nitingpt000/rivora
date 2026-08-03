import {
  FACTOR_LABELS,
  FACTOR_WEIGHTS,
  CUSTODY_MULTIPLIER,
  SCORE_BANDS,
  TIER_ADVANCE_RATE,
  TIER_LIMIT_CAP,
  TIER_MAX_HORIZON_DAYS,
  UNDERWRITING,
} from './constants';
import { usdc } from './format';
import type {
  Constraint,
  ConstraintKey,
  FactorPenalty,
  LimitDecision,
  LimitParams,
  QualityFactors,
  Tier,
} from './types';

/**
 * Composite quality factor. PRD §13.3.
 *
 * The earlier multiplicative form compounded too harshly: a competent borrower
 * scoring 0.85 on every dimension received 0.85^5, turning a stated 30% advance
 * rate into an effective 13%. Weighted penalties against a base of one keep the
 * stated rate approximately honest and make each factor's contribution
 * directly readable, which is what makes the decision explanation mechanical
 * rather than narrated.
 */
export function qualityFactor(factors: QualityFactors): number {
  const haircut = (Object.keys(FACTOR_WEIGHTS) as Array<keyof QualityFactors>).reduce(
    (sum, key) => sum + FACTOR_WEIGHTS[key] * (1 - factors[key]),
    0,
  );
  return clamp(1 - haircut, UNDERWRITING.qMin, 1);
}

/** Per-factor contribution to the quality haircut, in percentage points. */
export function factorPenalties(factors: QualityFactors): FactorPenalty[] {
  return (Object.keys(FACTOR_WEIGHTS) as Array<keyof QualityFactors>)
    .map((key) => ({
      symbol: key,
      label: FACTOR_LABELS[key],
      value: factors[key],
      weight: FACTOR_WEIGHTS[key],
      points: FACTOR_WEIGHTS[key] * (1 - factors[key]) * 100,
    }))
    .sort((a, b) => b.points - a.points);
}

/** Score band → tier. PRD §14.2. */
export function tierForScore(score: number): Tier {
  return SCORE_BANDS.find((band) => score >= band.min)?.tier ?? 'Ineligible';
}

/**
 * The advance rate is derived, not chosen. PRD §13.4.
 *
 * `A_max = (repaymentBps / 10,000) × (T_max / 30)`. At the default 20% routing
 * over a 45-day horizon this recovers 30% exactly — which is where the figure
 * in the earlier draft came from, now with a reason attached.
 */
export function maxAdvanceRateFromHorizon(repaymentBps: number, maxHorizonDays: number): number {
  return (repaymentBps / 10_000) * (maxHorizonDays / 30);
}

/**
 * The full limit decision: every candidate limit, the minimum of them, and the
 * rung that bound.
 *
 * Returning the whole ladder rather than just the number is deliberate. A
 * borrower told only "your limit is 2,530" will try to improve metrics that are
 * not the constraint; a borrower shown that the growth cap bound knows the
 * correct action is to wait. PRD §14.5.
 */
export function calculateLimit(params: LimitParams): LimitDecision {
  const {
    normalizedRevenue30d: revenue,
    tier,
    factors,
    custody,
    repaymentBps,
    previousLimit,
    vaultAssets,
    historyDays,
    completedCycles = 0,
  } = params;

  const quality = qualityFactor(factors);
  const advanceRate = TIER_ADVANCE_RATE[tier];
  const horizonDays = TIER_MAX_HORIZON_DAYS[tier];
  const repaymentShare = repaymentBps / 10_000;

  const qualityLimit = revenue * advanceRate * quality * factors.G;
  const horizonLimit = revenue * repaymentShare * (horizonDays / 30);
  const stressedHorizonLimit =
    revenue *
    UNDERWRITING.stressRevenueFactor *
    repaymentShare *
    (UNDERWRITING.stressMaxHorizonDays / 30);
  const custodyLimit = horizonLimit * CUSTODY_MULTIPLIER[custody];
  const tierCap = TIER_LIMIT_CAP[tier];
  const exposureCap = vaultAssets * UNDERWRITING.exposureCapPct;
  const growthCapLimit = previousLimit > 0 ? previousLimit * UNDERWRITING.growthCap : Infinity;
  // The new-borrower cap bounds exposure to a borrower whose repayment loop is
  // unproven. Calendar age alone is a weak proxy for that: what the protocol
  // actually wants to see is revenue routed through the router and a loan taken
  // to zero. A completed cycle is that proof, so it lifts the cap early — the
  // same logic PRD §34.5 uses to gate cohort progression on completed cycles
  // rather than elapsed time.
  const unproven =
    historyDays < UNDERWRITING.newBorrowerHistoryDays && completedCycles < 1;
  const newBorrowerCap = unproven ? UNDERWRITING.newBorrowerCap : Infinity;

  const candidates: Array<Omit<Constraint, 'binding'>> = [
    {
      key: 'quality',
      label: 'Quality-derived limit',
      formula: `${usdc(revenue)} × ${advanceRate.toFixed(2)} × ${quality.toFixed(4)} × ${factors.G.toFixed(2)}`,
      value: qualityLimit,
    },
    {
      key: 'horizon',
      label: 'Repayment-horizon limit',
      formula: `${usdc(revenue)} × ${repaymentShare.toFixed(2)} × (${horizonDays}/30)`,
      value: horizonLimit,
    },
    {
      key: 'stressedHorizon',
      label: 'Stressed-horizon limit',
      formula: `(${usdc(revenue)} × ${UNDERWRITING.stressRevenueFactor}) × ${repaymentShare.toFixed(2)} × 3`,
      value: stressedHorizonLimit,
    },
    {
      key: 'custody',
      label: `Custody cap (Model ${custody})`,
      formula: custody === 'A' ? 'no reduction' : `${CUSTODY_MULTIPLIER[custody] * 100}% of horizon`,
      value: custodyLimit,
    },
    { key: 'tierCap', label: `Tier cap (${tier})`, formula: '', value: tierCap },
  ];

  if (Number.isFinite(newBorrowerCap)) {
    candidates.push({
      key: 'newBorrower',
      label: 'New-borrower cap',
      formula: `history ${historyDays} d < ${UNDERWRITING.newBorrowerHistoryDays} d, no completed cycle`,
      value: newBorrowerCap,
    });
  }
  if (Number.isFinite(growthCapLimit)) {
    candidates.push({
      key: 'growthCap',
      label: 'Per-assessment growth cap',
      formula: `${usdc(previousLimit)} × ${UNDERWRITING.growthCap.toFixed(2)}`,
      value: growthCapLimit,
    });
  }

  const min = candidates.reduce((lowest, c) => Math.min(lowest, c.value), Infinity);
  const bindingKey = candidates.find((c) => c.value === min)?.key ?? 'quality';

  // A rung within 25% of the binding value will bind on a modest change in
  // conditions. Flagging it now is cheaper than surprising the borrower later.
  const nearThreshold = min * 1.25;

  const ladder: Constraint[] = candidates.map((c) => ({
    ...c,
    binding: c.key === bindingKey,
    nearBinding: c.key !== bindingKey && c.value <= nearThreshold,
  }));

  // The per-borrower exposure cap is shown on the ladder but does not
  // constrain the approved limit.
  //
  // PRD §31.5 and the risk console (screens.md S-54) both measure this cap
  // against *outstanding principal* — 2,400 drawn against a 25,000 vault reads
  // as 9.6% and breached. It is therefore a draw-time control, not an
  // underwriting one: the protocol may approve a limit above 5% of the vault
  // and still refuse the draw that would take actual exposure past it. Folding
  // it into `min()` here would silently crush limits in a small vault and
  // contradict the constraint ladder the borrower is shown.
  ladder.push({
    key: 'exposure',
    label: 'Exposure cap (5% of vault)',
    formula: `${usdc(vaultAssets)} × ${UNDERWRITING.exposureCapPct}`,
    value: exposureCap,
    binding: false,
    advisory: true,
    nearBinding: exposureCap <= nearThreshold,
  });

  return {
    limit: floorTo(Math.max(0, min), 10),
    quality,
    ladder,
    bindingKey: bindingKey as ConstraintKey,
    penalties: factorPenalties(factors),
  };
}

/** Available credit. PRD §10.4 — interest is not deducted, only principal. */
export function availableCredit(limit: number, principal: number, pendingDraws = 0): number {
  return Math.max(0, limit - principal - pendingDraws);
}

/**
 * Herfindahl-Hirschman Index over revenue shares. PRD §13.7.
 * `shares` are proportions and should sum to roughly 1.
 */
export function hhi(shares: number[]): number {
  return shares.reduce((sum, s) => sum + s * s, 0);
}

/**
 * Concentration factor. PRD §13.7.
 *
 * The 0.40 floor of the earlier draft is removed: a borrower with a single
 * customer at 100% has HHI 1.0 and should not receive a 60% haircut — it is one
 * email away from zero revenue. `qMin` still stops any one factor driving the
 * limit to zero on its own.
 */
export function concentrationFactor(hhiValue: number): number {
  return clamp(1 - hhiValue, 0, 1);
}

/** Bucketed concentration band for public and LP-facing surfaces. PRD §21.3. */
/**
 * Concentration band from a Herfindahl index.
 *
 * `hhiValue` is on the conventional 0–10,000 scale — the sum of squared
 * percentage shares — which is what the protocol computes and stores. HIGH
 * begins exactly where `UNDERWRITING.hhiCeiling` drives the diversity signal
 * to zero, so the label and the score agree about when concentration has
 * stopped being survivable.
 */
export function concentrationBand(hhiValue: number): 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' {
  if (hhiValue < 1_000) return 'LOW';
  if (hhiValue < 1_500) return 'MODERATE';
  if (hhiValue < UNDERWRITING.hhiCeiling) return 'ELEVATED';
  return 'HIGH';
}

/**
 * Time-weighted, median-clamped revenue base. PRD §13.2.
 *
 * `daily` is ordered oldest → newest. The clamp is what stops three
 * manufactured days from driving the limit: genuine growth lifts the mean and
 * the median together, so it does not bind.
 */
export function normalizeRevenue(daily: number[]): number {
  if (daily.length === 0) return 0;
  const { timeWeightLambda: lambda, medianClampK: k } = UNDERWRITING;

  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < daily.length; i += 1) {
    const age = daily.length - 1 - i;
    const weight = Math.pow(lambda, age);
    weightedSum += (daily[i] ?? 0) * weight;
    weightTotal += weight;
  }
  const weighted = (weightedSum / weightTotal) * daily.length;

  const sorted = [...daily].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);

  return Math.min(weighted, median * daily.length * k);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function floorTo(value: number, step: number): number {
  return Math.floor(value / step) * step;
}
