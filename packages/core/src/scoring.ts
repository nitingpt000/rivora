import { CUSTODY_MULTIPLIER, SCORE_WEIGHTS, UNDERWRITING } from './constants';
import type { CustodyModel, ScoreComponent, ScoreSignals } from './types';

/**
 * The 0–100 risk score and its breakdown. PRD §14.3.
 *
 * Every signal is normalised to 0–1 here rather than stored that way, so the
 * score is reproducible from observable facts: uptime, payer counts, cycles
 * completed. A stored score nobody can recompute is an assertion, and the
 * whole product rests on underwriting being mechanical.
 *
 * Each `norm*` function below is where the judgement lives — what counts as
 * good uptime, how much concentration is too much. They are separate and named
 * so that changing one is a visible, reviewable edit rather than a tweaked
 * constant buried in a sum.
 */
export function scoreComponents(signals: ScoreSignals): ScoreComponent[] {
  const values: Record<(typeof SCORE_WEIGHTS)[number]['key'], number> = {
    reliability: normReliability(signals.uptimePct, signals.successPct),
    consistency: normConsistency(signals.revenueCv),
    repayment: normRepayment(signals.onTimeRatioPct, signals.completedCycles),
    concentration: normConcentration(signals.largestPayerPct),
    diversity: normDiversity(signals.uniquePayers, signals.hhi),
    custody: normCustody(signals.custody),
    history: normHistory(signals.historyDays),
    growth: normGrowth(signals.growthPct),
    reserve: normReserve(signals.reserveCoveragePct),
  };

  return SCORE_WEIGHTS.map((signal) => {
    const value = clamp01(values[signal.key]);
    return {
      key: signal.key,
      label: signal.label,
      weight: signal.weight,
      value,
      contribution: value * signal.weight * 100,
    };
  });
}

/** Sum of the weighted components, rounded to a whole point. */
export function compositeScore(signals: ScoreSignals): number {
  const total = scoreComponents(signals).reduce((sum, c) => sum + c.contribution, 0);
  return Math.round(clamp(total, 0, 100));
}

/**
 * Uptime and fulfilment together.
 *
 * A service that answers every request with an error is up by one measure and
 * useless by the other, so neither alone can carry the signal.
 */
function normReliability(uptimePct: number, successPct: number): number {
  return (floorScale(uptimePct, 95) + floorScale(successPct, 90)) / 2;
}

/**
 * Revenue steadiness, from the coefficient of variation of the daily series.
 *
 * A CV of 0 is perfectly flat; 0.6 or worse reads as noise rather than a
 * business, and earns nothing here.
 */
function normConsistency(revenueCv: number): number {
  return clamp01(1 - revenueCv / 0.6);
}

/**
 * Repayment record, discounted until there is one.
 *
 * A borrower with no completed cycles has not demonstrated repayment, so a
 * perfect on-time ratio over zero cycles cannot score full marks — otherwise
 * every new borrower would arrive with a flawless history.
 */
function normRepayment(onTimeRatioPct: number, completedCycles: number): number {
  const confidence = clamp01(completedCycles / UNDERWRITING.cyclesForFullConfidence);
  const record = clamp01(onTimeRatioPct / 100);
  return UNDERWRITING.repaymentPriorWeight + (record - UNDERWRITING.repaymentPriorWeight) * confidence;
}

/** Concentration, against the ceiling above which a single payer dominates. */
function normConcentration(largestPayerPct: number): number {
  return clamp01(1 - largestPayerPct / UNDERWRITING.concentrationCeilingPct);
}

/** Payer count and HHI together: many payers, none of them dominant. */
function normDiversity(uniquePayers: number, hhi: number): number {
  const breadth = clamp01(Math.log10(Math.max(uniquePayers, 1) + 1) / Math.log10(51));
  const evenness = clamp01(1 - hhi / UNDERWRITING.hhiCeiling);
  return (breadth + evenness) / 2;
}

/** Custody strength, reusing the same multipliers the limit is built from. */
function normCustody(custody: CustodyModel): number {
  return clamp01(CUSTODY_MULTIPLIER[custody]);
}

/** Operating history, saturating at the point further tenure adds little. */
function normHistory(historyDays: number): number {
  return clamp01(historyDays / UNDERWRITING.historyDaysForFullCredit);
}

/**
 * Growth, centred on flat.
 *
 * Flat revenue is neutral, not a failure. Decline is penalised and rapid
 * growth is capped, because revenue that triples in a month is as likely to be
 * a spike as a trend and lending against it is how a limit outruns the book.
 */
function normGrowth(growthPct: number): number {
  return clamp01(0.5 + growthPct / (2 * UNDERWRITING.growthPctForFullCredit));
}

/** Reserve coverage against target. */
function normReserve(reserveCoveragePct: number): number {
  return clamp01(reserveCoveragePct / 100);
}

/**
 * Rescales a percentage that only becomes meaningful near the top.
 *
 * 99.4% uptime and 97% uptime are very different services, and a linear /100
 * scale would call them nearly identical.
 */
function floorScale(pct: number, floor: number): number {
  return clamp01((pct - floor) / (100 - floor));
}

/**
 * Coefficient of variation of a series — standard deviation over mean.
 *
 * Exported because it is the input to the consistency signal and the caller
 * holds the daily series, not this module.
 */
export function coefficientOfVariation(series: readonly number[]): number {
  if (series.length < 2) return 0;

  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  if (mean <= 0) return 0;

  const variance = series.reduce((sum, v) => sum + (v - mean) ** 2, 0) / series.length;
  return Math.sqrt(variance) / mean;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
