import { describe, expect, it } from 'vitest';

import { detect, severest, type DetectionSignals } from './detection';

/**
 * The PRD's §35.3 scenario is the case that matters: a borrower whose own
 * operating wallet funded the payers that made them look creditworthy. These
 * tests are that scenario and its near misses, because a detector that fires
 * on an honest borrower is worse than one that does not fire at all.
 */
function signals(overrides: Partial<DetectionSignals> = {}): DetectionSignals {
  return {
    eligible: 13_500,
    priorEligible: 13_500,
    hhi: 653,
    priorHhi: 653,
    largestPayerPct: 14,
    washAmount: 0,
    washPayers: 0,
    washDays: 0,
    gross: 14_040,
    successPct: 96.2,
    priorSuccessPct: 96.2,
    ...overrides,
  };
}

describe('a healthy borrower', () => {
  it('trips nothing', () => {
    expect(detect(signals())).toEqual([]);
  });

  it('is not restricted by ordinary variation', () => {
    // Revenue down a tenth, concentration drifting up a little.
    const findings = detect(signals({ eligible: 12_200, hhi: 800 }));
    expect(findings).toEqual([]);
  });
});

describe('circular funding — the PRD §35.3 scenario', () => {
  it('restricts when related payers hold a tenth of gross', () => {
    // 2,400 USDC across 3 payers over 9 days, as the PRD describes.
    const findings = detect(
      signals({ washAmount: 2_400, washPayers: 3, washDays: 9, gross: 14_040 }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'circular', action: 'restrict' });
    expect(findings[0]!.reason).toContain('3 related payers');
    expect(findings[0]!.reason).toContain('2400.00 USDC');
    expect(findings[0]!.reason).toContain('9 settled days');
  });

  it('leaves a single related payer alone', () => {
    // One wallet at 15% is a fact about a customer, not about the borrower.
    const findings = detect(signals({ washAmount: 2_100, washPayers: 1, washDays: 6 }));
    expect(findings.some((f) => f.kind === 'circular')).toBe(false);
  });

  it('leaves a small amount alone however many payers', () => {
    const findings = detect(signals({ washAmount: 200, washPayers: 8, washDays: 12 }));
    expect(findings.some((f) => f.kind === 'circular')).toBe(false);
  });
});

describe('revenue decline', () => {
  it('freezes draws when a quarter of the base disappears', () => {
    const findings = detect(signals({ eligible: 9_000, priorEligible: 13_500 }));

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'revenue_decline', action: 'watch' });
    expect(findings[0]!.reason).toContain('33.3%');
  });

  it('says nothing about a borrower who has only just started', () => {
    // No prior window: this is a first batch, not a collapse.
    const findings = detect(signals({ eligible: 100, priorEligible: 0 }));
    expect(findings.some((f) => f.kind === 'revenue_decline')).toBe(false);
  });

  it('says nothing about revenue going up', () => {
    const findings = detect(signals({ eligible: 20_000, priorEligible: 13_500 }));
    expect(findings.some((f) => f.kind === 'revenue_decline')).toBe(false);
  });
});

describe('concentration', () => {
  it('freezes draws on a sharp rise, even below the ceiling', () => {
    const findings = detect(signals({ hhi: 1_500, priorHhi: 653, largestPayerPct: 31 }));

    expect(findings[0]).toMatchObject({ kind: 'concentration', action: 'watch' });
    expect(findings[0]!.reason).toContain('rose 847 points');
  });

  it('freezes draws at the ceiling however it was reached', () => {
    // Crept up slowly — no jump, but the level is unacceptable.
    const findings = detect(signals({ hhi: 2_600, priorHhi: 2_500, largestPayerPct: 48 }));

    expect(findings[0]).toMatchObject({ kind: 'concentration', action: 'watch' });
    expect(findings[0]!.reason).toContain('ceiling');
  });

  it('ignores concentration falling', () => {
    const findings = detect(signals({ hhi: 400, priorHhi: 1_200 }));
    expect(findings.some((f) => f.kind === 'concentration')).toBe(false);
  });
});

describe('several findings at once', () => {
  it('restriction outranks a freeze', () => {
    // Manufactured revenue AND a collapse: the restriction must win, or the
    // borrower ends up merely watched because of evaluation order.
    const findings = detect(
      signals({
        washAmount: 2_400,
        washPayers: 3,
        washDays: 9,
        eligible: 8_000,
        priorEligible: 13_500,
        hhi: 2_700,
      }),
    );

    expect(findings.length).toBeGreaterThan(1);
    expect(severest(findings)).toMatchObject({ action: 'restrict' });
  });

  it('returns nothing to act on when nothing fired', () => {
    expect(severest(detect(signals()))).toBeNull();
  });
});

describe('failure rate', () => {
  it('freezes draws when fulfilment falls below the floor', () => {
    const findings = detect(signals({ successPct: 84.5, priorSuccessPct: 96.2 }));

    expect(findings[0]).toMatchObject({ kind: 'failure_rate', action: 'watch' });
    expect(findings[0]!.reason).toContain('84.5%');
  });

  it('freezes draws on a sharp drop even from a healthy level', () => {
    const findings = detect(signals({ successPct: 91.0, priorSuccessPct: 98.0 }));

    expect(findings[0]).toMatchObject({ kind: 'failure_rate' });
    expect(findings[0]!.reason).toContain('fell 7.0 points');
  });

  it('ignores ordinary variation', () => {
    expect(detect(signals({ successPct: 95.1, priorSuccessPct: 96.2 }))).toEqual([]);
  });

  it('says nothing when reliability was never measured', () => {
    // An indexer that reports no failure counts leaves successPct at its
    // seeded value. Freezing draws over an unmeasured number would be acting
    // on a fixture.
    expect(detect(signals({ successPct: 0, priorSuccessPct: 0 }))).toEqual([]);
    expect(detect(signals({ successPct: 50, priorSuccessPct: 0 }))).toEqual([]);
  });
});
