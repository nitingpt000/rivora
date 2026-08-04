import { describe, expect, it } from 'vitest';

import { attributionStats } from './attribution';

/**
 * The property under test: attribution coverage is priced, not assumed.
 * Full attribution reproduces the plain payer arithmetic; zero attribution
 * collapses to one payer holding everything; partial degrades continuously
 * and monotonically between them.
 */

const payer = (revenue: number, daysActive = 1, excluded = false) => ({
  revenue,
  daysActive,
  excluded,
});

describe('full attribution', () => {
  it('reproduces plain payer arithmetic and reports 100%', () => {
    // Four equal payers over the whole eligible total.
    const stats = attributionStats([payer(250), payer(250), payer(250), payer(250)], 1_000);

    expect(stats.attributedPct).toBe(100);
    expect(stats.largestPayerPct).toBe(25);
    expect(stats.hhi).toBe(2_500); // 4 × 25²
    expect(stats.uniquePayers).toBe(4);
  });

  it('treats six-decimal float dust as attributed, not as a payer', () => {
    const stats = attributionStats([payer(999.999999)], 1_000);
    expect(stats.uniquePayers).toBe(1);
    expect(stats.attributedPct).toBe(100);
  });
});

describe('zero attribution', () => {
  it('collapses to one payer holding 100% — HHI 10,000', () => {
    const stats = attributionStats([], 1_000);

    expect(stats.largestPayerPct).toBe(100);
    expect(stats.hhi).toBe(10_000);
    expect(stats.uniquePayers).toBe(1);
    expect(stats.attributedPct).toBe(0);
  });

  it('an empty window screams about nothing', () => {
    const stats = attributionStats([], 0);
    expect(stats).toMatchObject({
      largestPayerPct: 0,
      hhi: 0,
      uniquePayers: 0,
      attributedPct: 100,
    });
  });
});

describe('partial attribution', () => {
  it('prices the unattributed remainder as the largest single payer', () => {
    // 60% attributed across three equal payers, 40% unknown.
    const stats = attributionStats([payer(200), payer(200), payer(200)], 1_000);

    expect(stats.attributedPct).toBe(60);
    expect(stats.largestPayerPct).toBe(40); // the unknown mass
    expect(stats.hhi).toBe(3 * 400 + 1_600); // 3×20² + 40²
    expect(stats.uniquePayers).toBe(4); // three known + the unknown
  });

  it('degrades monotonically as attribution falls', () => {
    const at = (attributed: number) =>
      attributionStats(
        Array.from({ length: 10 }, () => payer(attributed / 10)),
        1_000,
      );

    const full = at(1_000);
    const most = at(800);
    const little = at(300);

    expect(full.hhi).toBeLessThan(most.hhi);
    expect(most.hhi).toBeLessThan(little.hhi);
    expect(full.largestPayerPct).toBeLessThan(most.largestPayerPct);
    expect(most.largestPayerPct).toBeLessThan(little.largestPayerPct);
  });
});

describe('exclusions and inconsistencies', () => {
  it('excluded payers attribute nothing — their mass reads as unknown', () => {
    // One clean payer, one excluded wash-trader, over a 1,000 window.
    const stats = attributionStats([payer(500), payer(500, 1, true)], 1_000);

    // The excluded payer's 500 is not credited as attribution: eligible
    // already nets exclusions out upstream, so a window where it does not
    // reads as half-unknown rather than as half-clean.
    expect(stats.attributedPct).toBe(50);
    expect(stats.uniquePayers).toBe(2); // one known + the unknown mass
  });

  it('attribution above eligible is clamped, never a credit', () => {
    const stats = attributionStats([payer(1_200)], 1_000);
    expect(stats.attributedPct).toBe(100);
    expect(stats.largestPayerPct).toBe(100);
  });

  it('repeat behaviour counts only where attribution exists', () => {
    const stats = attributionStats([payer(300, 5), payer(300, 1)], 1_000);
    expect(stats.repeatPayers).toBe(1);
  });
});
