import { describe, expect, it } from 'vitest';

import { SCORE_WEIGHTS } from './constants';
import { coefficientOfVariation, compositeScore, scoreComponents } from './scoring';
import type { ScoreSignals } from './types';

/** A competent, unremarkable borrower. */
function signals(overrides: Partial<ScoreSignals> = {}): ScoreSignals {
  return {
    uptimePct: 99.4,
    successPct: 96.2,
    revenueCv: 0.18,
    onTimeRatioPct: 100,
    completedCycles: 3,
    largestPayerPct: 14,
    hhi: 900,
    uniquePayers: 386,
    custody: 'A',
    historyDays: 60,
    growthPct: 12,
    reserveCoveragePct: 98,
    ...overrides,
  };
}

describe('scoreComponents', () => {
  it('returns one component per weighted signal, in weight order', () => {
    const components = scoreComponents(signals());

    expect(components).toHaveLength(SCORE_WEIGHTS.length);
    expect(components.map((c) => c.key)).toEqual(SCORE_WEIGHTS.map((w) => w.key));
  });

  it('keeps every normalised value inside 0–1', () => {
    // Deliberately out of range in both directions: uptime cannot exceed 100,
    // but growth and payer counts are unbounded inputs.
    const extreme = signals({
      growthPct: 500,
      uniquePayers: 1_000_000,
      largestPayerPct: 100,
      hhi: 10_000,
      revenueCv: 4,
    });

    for (const component of scoreComponents(extreme)) {
      expect(component.value).toBeGreaterThanOrEqual(0);
      expect(component.value).toBeLessThanOrEqual(1);
    }
  });

  it('contributes weight × value × 100 points', () => {
    for (const component of scoreComponents(signals())) {
      expect(component.contribution).toBeCloseTo(component.value * component.weight * 100, 10);
    }
  });

  it('weights sum to one, so a perfect borrower scores exactly 100', () => {
    const total = SCORE_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('compositeScore', () => {
  it('stays within 0–100', () => {
    expect(compositeScore(signals())).toBeGreaterThanOrEqual(0);
    expect(compositeScore(signals())).toBeLessThanOrEqual(100);
  });

  it('scores a strong borrower above a weak one', () => {
    const strong = compositeScore(
      signals({
        uptimePct: 99.9,
        successPct: 99.5,
        revenueCv: 0.05,
        largestPayerPct: 6,
        hhi: 300,
        uniquePayers: 900,
        historyDays: 400,
        completedCycles: 12,
      }),
    );

    const weak = compositeScore(
      signals({
        uptimePct: 91,
        successPct: 88,
        revenueCv: 0.9,
        onTimeRatioPct: 40,
        largestPayerPct: 70,
        hhi: 5_000,
        uniquePayers: 4,
        custody: 'C',
        historyDays: 20,
        growthPct: -40,
        reserveCoveragePct: 0,
      }),
    );

    expect(strong).toBeGreaterThan(weak);
  });

  it('discounts a spotless record earned over no completed cycles', () => {
    // Otherwise every borrower would arrive with a flawless repayment history
    // simply by never having repaid anything.
    const unproven = scoreComponents(signals({ completedCycles: 0, onTimeRatioPct: 100 }));
    const proven = scoreComponents(signals({ completedCycles: 12, onTimeRatioPct: 100 }));

    const repayment = (list: typeof unproven) =>
      list.find((c) => c.key === 'repayment')!.value;

    expect(repayment(unproven)).toBeLessThan(repayment(proven));
    expect(repayment(proven)).toBeCloseTo(1, 10);
  });

  it('treats flat revenue as neutral rather than as failure', () => {
    const flat = scoreComponents(signals({ growthPct: 0 }));
    expect(flat.find((c) => c.key === 'growth')!.value).toBeCloseTo(0.5, 10);
  });

  it('penalises decline symmetrically with growth', () => {
    const up = scoreComponents(signals({ growthPct: 10 })).find((c) => c.key === 'growth')!.value;
    const down = scoreComponents(signals({ growthPct: -10 })).find((c) => c.key === 'growth')!
      .value;

    expect(up - 0.5).toBeCloseTo(0.5 - down, 10);
  });
});

describe('coefficientOfVariation', () => {
  it('is zero for a flat series', () => {
    expect(coefficientOfVariation([100, 100, 100, 100])).toBe(0);
  });

  it('rises with dispersion', () => {
    const steady = coefficientOfVariation([98, 100, 102, 100]);
    const erratic = coefficientOfVariation([10, 190, 5, 195]);

    expect(erratic).toBeGreaterThan(steady);
  });

  it('is scale-invariant — doubling every value leaves it unchanged', () => {
    const series = [42, 55, 48, 61, 52];
    expect(coefficientOfVariation(series.map((v) => v * 2))).toBeCloseTo(
      coefficientOfVariation(series),
      10,
    );
  });

  it('returns zero rather than dividing by a zero or empty mean', () => {
    expect(coefficientOfVariation([])).toBe(0);
    expect(coefficientOfVariation([5])).toBe(0);
    expect(coefficientOfVariation([0, 0, 0])).toBe(0);
  });
});
