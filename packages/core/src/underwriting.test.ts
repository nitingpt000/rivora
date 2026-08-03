import { describe, expect, it } from 'vitest';

import { UNDERWRITING } from './constants';
import {
  availableCredit,
  calculateLimit,
  concentrationBand,
  concentrationFactor,
  hhi,
  maxAdvanceRateFromHorizon,
  normalizeRevenue,
  qualityFactor,
  tierForScore,
} from './underwriting';

describe('qualityFactor', () => {
  it('reproduces the PRD §13.11 worked example', () => {
    // S 0.90, C 0.80, V 0.90, D 0.85, M 0.90
    // Q = 1 − [0.30(0.10) + 0.25(0.20) + 0.15(0.10) + 0.15(0.15) + 0.15(0.10)]
    //   = 1 − 0.1325 = 0.8675
    const q = qualityFactor({ S: 0.9, C: 0.8, V: 0.9, D: 0.85, M: 0.9 });
    expect(q).toBeCloseTo(0.8675, 6);
  });

  it('is 1 for a perfect borrower', () => {
    expect(qualityFactor({ S: 1, C: 1, V: 1, D: 1, M: 1 })).toBe(1);
  });

  it('floors at Q_min rather than reaching zero', () => {
    expect(qualityFactor({ S: 0, C: 0, V: 0, D: 0, M: 0 })).toBe(UNDERWRITING.qMin);
  });

  it('does not compound the way the discarded multiplicative form did', () => {
    // Five factors at 0.85: the old form gave 0.85^5 ≈ 0.4437, roughly halving
    // the stated advance rate. The additive form gives a 15% haircut.
    const q = qualityFactor({ S: 0.85, C: 0.85, V: 0.85, D: 0.85, M: 0.85 });
    expect(q).toBeCloseTo(0.85, 6);
    expect(q).toBeGreaterThan(0.85 ** 5);
  });
});

describe('maxAdvanceRateFromHorizon', () => {
  it('recovers the 30% advance rate from 20% routing over 45 days', () => {
    expect(maxAdvanceRateFromHorizon(2_000, 45)).toBeCloseTo(0.3, 10);
  });

  it('matches the PRD §13.4 table', () => {
    expect(maxAdvanceRateFromHorizon(2_000, 30)).toBeCloseTo(0.2, 10);
    expect(maxAdvanceRateFromHorizon(2_000, 60)).toBeCloseTo(0.4, 10);
    expect(maxAdvanceRateFromHorizon(3_000, 45)).toBeCloseTo(0.45, 10);
    expect(maxAdvanceRateFromHorizon(1_500, 60)).toBeCloseTo(0.3, 10);
  });
});

describe('tierForScore', () => {
  it('maps the PRD §14.2 bands', () => {
    expect(tierForScore(95)).toBe('Prime');
    expect(tierForScore(90)).toBe('Prime');
    expect(tierForScore(89)).toBe('Strong');
    expect(tierForScore(78)).toBe('Strong');
    expect(tierForScore(74)).toBe('Standard');
    expect(tierForScore(60)).toBe('Standard');
    expect(tierForScore(59)).toBe('Restricted');
    expect(tierForScore(39)).toBe('Ineligible');
    expect(tierForScore(0)).toBe('Ineligible');
  });
});

describe('calculateLimit', () => {
  it('reproduces MVP assessment 1 — quality binds at 1,690', () => {
    const decision = calculateLimit({
      normalizedRevenue30d: 10_000,
      tier: 'Standard',
      factors: { S: 0.88, C: 0.78, V: 0.85, D: 0.9, M: 0.85, G: 1.0 },
      custody: 'A',
      repaymentBps: 2_000,
      previousLimit: 0,
      vaultAssets: 25_000,
      historyDays: 30,
    });

    expect(decision.quality).toBeCloseTo(0.849, 6);
    expect(decision.bindingKey).toBe('quality');
    expect(decision.limit).toBe(1_690);
  });

  it('reproduces MVP assessment 2 — the growth cap binds at 2,530', () => {
    const decision = calculateLimit({
      normalizedRevenue30d: 13_500,
      tier: 'Strong',
      factors: { S: 0.95, C: 0.86, V: 0.9, D: 0.95, M: 0.88, G: 1.1 },
      custody: 'A',
      repaymentBps: 2_000,
      previousLimit: 1_690,
      vaultAssets: 25_000,
      historyDays: 60,
      completedCycles: 1,
    });

    expect(decision.quality).toBeCloseTo(0.9095, 6);

    // 13,500 × 0.30 × 0.9095 × 1.10 = 4,051.8225.
    // The PRD and screens.md both round this to 4,051.00 in prose.
    const quality = decision.ladder.find((c) => c.key === 'quality');
    expect(quality?.value).toBeCloseTo(4_051.82, 2);

    expect(decision.bindingKey).toBe('growthCap');
    expect(decision.limit).toBe(2_530);
  });

  it('reproduces the PRD §13.11 worked example at 2,730', () => {
    const decision = calculateLimit({
      normalizedRevenue30d: 10_000,
      tier: 'Strong',
      factors: { S: 0.9, C: 0.8, V: 0.9, D: 0.85, M: 0.9, G: 1.05 },
      custody: 'A',
      repaymentBps: 2_000,
      previousLimit: 2_100,
      vaultAssets: 100_000,
      historyDays: 200,
    });

    expect(decision.limit).toBe(2_730);
    expect(decision.bindingKey).toBe('quality');
    // Effective advance rate ≈ 27.3% against a stated 30% — the deviation is
    // exactly the quality haircut, which is the point of the additive form.
    expect(decision.limit / 10_000).toBeCloseTo(0.273, 3);
  });

  it('cuts the limit hard for a borrower on custody model C', () => {
    const base = {
      normalizedRevenue30d: 10_000,
      tier: 'Strong' as const,
      factors: { S: 0.95, C: 0.95, V: 0.95, D: 0.95, M: 0.95, G: 1 },
      repaymentBps: 2_000,
      previousLimit: 50_000,
      vaultAssets: 1_000_000,
      historyDays: 400,
    };

    const modelA = calculateLimit({ ...base, custody: 'A' });
    const modelC = calculateLimit({ ...base, custody: 'C' });

    expect(modelC.bindingKey).toBe('custody');
    expect(modelC.limit).toBeLessThan(modelA.limit);
    // Model C is capped at 25% of the horizon limit: 10,000 × 0.20 × 2 × 0.25
    expect(modelC.limit).toBe(1_000);
  });

  it('applies the new-borrower cap to an unproven borrower', () => {
    const decision = calculateLimit({
      normalizedRevenue30d: 200_000,
      tier: 'Strong',
      factors: { S: 1, C: 1, V: 1, D: 1, M: 1, G: 1 },
      custody: 'A',
      repaymentBps: 2_000,
      previousLimit: 20_000,
      vaultAssets: 10_000_000,
      historyDays: 45,
      completedCycles: 0,
    });

    expect(decision.bindingKey).toBe('newBorrower');
    expect(decision.limit).toBe(UNDERWRITING.newBorrowerCap);
  });

  it('lifts the new-borrower cap once a repayment cycle completes', () => {
    // The cap bounds exposure to an unproven repayment loop. A borrower that
    // has taken a loan to zero has proven it, even inside 90 days.
    const shared = {
      normalizedRevenue30d: 200_000,
      tier: 'Strong' as const,
      factors: { S: 1, C: 1, V: 1, D: 1, M: 1, G: 1 },
      custody: 'A' as const,
      repaymentBps: 2_000,
      previousLimit: 20_000,
      vaultAssets: 10_000_000,
      historyDays: 45,
    };

    expect(calculateLimit({ ...shared, completedCycles: 0 }).bindingKey).toBe('newBorrower');
    expect(calculateLimit({ ...shared, completedCycles: 1 }).bindingKey).not.toBe('newBorrower');
  });

  it('lists the exposure cap as advisory rather than binding', () => {
    // The cap is measured against outstanding principal at draw time
    // (screens.md S-54), so a small vault must not silently crush the limit.
    const decision = calculateLimit({
      normalizedRevenue30d: 13_500,
      tier: 'Strong',
      factors: { S: 0.95, C: 0.86, V: 0.9, D: 0.95, M: 0.88, G: 1.1 },
      custody: 'A',
      repaymentBps: 2_000,
      previousLimit: 1_690,
      vaultAssets: 25_000,
      historyDays: 60,
      completedCycles: 1,
    });

    const exposure = decision.ladder.find((c) => c.key === 'exposure');
    expect(exposure?.advisory).toBe(true);
    expect(exposure?.binding).toBe(false);
    expect(exposure?.value).toBe(1_250);
    expect(decision.limit).toBeGreaterThan(1_250);
  });

  it('orders penalties largest first so the explanation names the real cause', () => {
    const decision = calculateLimit({
      normalizedRevenue30d: 10_000,
      tier: 'Standard',
      factors: { S: 0.95, C: 0.5, V: 0.95, D: 0.95, M: 0.95, G: 1 },
      custody: 'A',
      repaymentBps: 2_000,
      previousLimit: 5_000,
      vaultAssets: 500_000,
      historyDays: 200,
    });

    expect(decision.penalties[0]?.symbol).toBe('C');
    const points = decision.penalties.map((p) => p.points);
    expect([...points].sort((a, b) => b - a)).toEqual(points);
  });
});

describe('concentration', () => {
  it('computes HHI over revenue shares', () => {
    expect(hhi([0.8, 0.1, 0.1])).toBeCloseTo(0.66, 10);
    expect(hhi(Array.from({ length: 10 }, () => 0.1))).toBeCloseTo(0.1, 10);
  });

  it('removes the 0.40 floor the earlier draft carried', () => {
    // A single customer at 100% is not a 60% haircut — it is one email away
    // from zero revenue.
    expect(concentrationFactor(1)).toBe(0);
    expect(concentrationFactor(0.66)).toBeCloseTo(0.34, 10);
    expect(concentrationFactor(0.1)).toBeCloseTo(0.9, 10);
  });

  it('buckets into disclosure bands', () => {
    // The conventional 0–10,000 Herfindahl scale, not a fraction.
    expect(concentrationBand(500)).toBe('LOW');
    expect(concentrationBand(1_400)).toBe('MODERATE');
    expect(concentrationBand(1_900)).toBe('ELEVATED');
    expect(concentrationBand(4_000)).toBe('HIGH');

    // HIGH starts where the diversity signal reaches zero, so a borrower is
    // never labelled ELEVATED while scoring as though concentration is fatal.
    expect(concentrationBand(UNDERWRITING.hhiCeiling)).toBe('HIGH');
  });
});

describe('normalizeRevenue', () => {
  it('leaves steady revenue essentially unchanged', () => {
    const steady = Array.from({ length: 30 }, () => 450);
    expect(normalizeRevenue(steady)).toBeCloseTo(13_500, 6);
  });

  it('clamps a manufactured burst against the median', () => {
    // 27 quiet days then three very large ones: the raw sum would justify a
    // far higher limit than the borrower's actual run-rate supports.
    const spiked = [...Array.from({ length: 27 }, () => 100), 5_000, 5_000, 5_000];
    const raw = spiked.reduce((a, b) => a + b, 0);
    const normalized = normalizeRevenue(spiked);

    expect(normalized).toBeLessThan(raw);
    // median 100 × 30 days × k(1.5) = 4,500
    expect(normalized).toBeCloseTo(4_500, 6);
  });

  it('does not bind on genuine steady growth', () => {
    const growing = Array.from({ length: 30 }, (_, i) => 300 + i * 10);
    const median = 300 + 14.5 * 10;
    expect(normalizeRevenue(growing)).toBeLessThanOrEqual(median * 30 * 1.5);
    expect(normalizeRevenue(growing)).toBeGreaterThan(300 * 30);
  });

  it('returns zero for an empty window', () => {
    expect(normalizeRevenue([])).toBe(0);
  });
});

describe('availableCredit', () => {
  it('deducts principal and pending draws but not accrued interest', () => {
    // PRD §10.4 defines available credit on principal only.
    expect(availableCredit(2_530, 2_000)).toBe(530);
    expect(availableCredit(2_530, 2_000, 100)).toBe(430);
  });

  it('never goes negative', () => {
    expect(availableCredit(1_000, 2_000)).toBe(0);
  });
});
