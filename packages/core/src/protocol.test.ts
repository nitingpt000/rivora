import { describe, expect, it } from 'vitest';

import { COVERAGE, VAULT } from './constants';
import { quoteDraw } from './draw';
import { shortAddress, signedPct, usdc } from './format';
import { baseRate, borrowerRate, utilization } from './rates';
import {
  applyRepayment,
  coverageState,
  interestCoverage,
  projectedPayback,
  routedCoverageState,
  splitRevenue,
} from './repayment';
import { applyLossWaterfall, planWithdrawal, withdrawalFeeRate } from './vault';

describe('rates', () => {
  it('computes utilization against liquidity plus outstanding', () => {
    expect(utilization(8_470, 16_530)).toBeCloseTo(0.3388, 4);
    expect(utilization(0, 25_000)).toBe(0);
  });

  it('follows the kinked curve from PRD §15.2', () => {
    expect(baseRate(0.3)).toBeCloseTo(7.4, 6);
    expect(baseRate(0.6)).toBeCloseTo(9.8, 6);
    expect(baseRate(0.8)).toBeCloseTo(11.4, 6);
    expect(baseRate(0.9)).toBeCloseTo(19.4, 6);
    expect(baseRate(0.95)).toBeCloseTo(23.4, 6);
  });

  it('is continuous at the kink', () => {
    expect(baseRate(0.8)).toBeCloseTo(baseRate(0.8 + 1e-9), 6);
  });

  it('adds the tier premium', () => {
    // The canonical dataset: U 33.88%, Strong premium 3 → 10.71%
    expect(borrowerRate(utilization(8_470, 16_530), 'Strong')).toBeCloseTo(10.71, 2);
    expect(borrowerRate(0.3, 'Standard')).toBeCloseTo(13.4, 6);
  });
});

describe('splitRevenue', () => {
  it('splits 100 USDC into 20 / 2 / 78', () => {
    const split = splitRevenue(100, 2_000, 200);
    expect(split.toRepayment).toBe(20);
    expect(split.toReserve).toBe(2);
    expect(split.toOperating).toBe(78);
  });

  it('always sums exactly to the gross', () => {
    // PRD §22.5: total distributed must equal revenue received. The operating
    // share is a remainder, so rounding cannot mint or lose a unit.
    for (const gross of [100, 450, 13.37, 0.01, 999_999.99, 7]) {
      const s = splitRevenue(gross, 2_000, 200);
      expect(s.toRepayment + s.toReserve + s.toOperating).toBeCloseTo(gross, 10);
    }
  });

  it('routes nothing to repayment when there is no debt', () => {
    const split = splitRevenue(100, 2_000, 200, { hasDebt: false, reserveAtTarget: false });
    expect(split.toRepayment).toBe(0);
    expect(split.toReserve).toBe(2);
    expect(split.toOperating).toBe(98);
  });

  it('sends everything to the borrower once debt and reserve target are cleared', () => {
    const split = splitRevenue(100, 2_000, 200, { hasDebt: false, reserveAtTarget: true });
    expect(split.toOperating).toBe(100);
  });
});

describe('applyRepayment', () => {
  it('applies interest first, then principal', () => {
    const r = applyRepayment(500, 2_000, 8.42);
    expect(r.toInterest).toBe(8.42);
    expect(r.toPrincipal).toBe(491.58);
    expect(r.excess).toBe(0);
    expect(r.clearsDebt).toBe(false);
  });

  it('returns the excess and marks the loan cleared', () => {
    const r = applyRepayment(2_500, 2_000, 8.42);
    expect(r.toInterest).toBe(8.42);
    expect(r.toPrincipal).toBe(2_000);
    expect(r.excess).toBeCloseTo(491.58, 2);
    expect(r.clearsDebt).toBe(true);
  });

  it('never distributes more than the payment', () => {
    const r = applyRepayment(100, 2_000, 8.42);
    expect(r.toInterest + r.toPrincipal + r.excess).toBeCloseTo(100, 6);
  });
});

describe('interest coverage', () => {
  it('is comfortable under default parameters', () => {
    const coverage = interestCoverage(450, 2_000, 2_008.42, 10.71);
    expect(coverage).toBeGreaterThan(100);
    expect(coverageState(coverage)).toBe('healthy');
  });

  it('scales linearly with revenue, so collapse is what drives it under 1', () => {
    // Negative amortization is not reachable from the interest rate — it takes
    // an ~800% APR. What the ratio actually catches is revenue collapse against
    // unchanged principal, and it degrades in proportion to the collapse.
    const healthy = interestCoverage(450, 2_000, 2_008.42, 10.71);
    const halved = interestCoverage(225, 2_000, 2_008.42, 10.71);
    expect(halved).toBeCloseTo(healthy / 2, 6);

    // Revenue at 1% of its previous level still reads as "repaying 20% of
    // revenue" — the ratio is the only signal that says otherwise.
    const collapsed = interestCoverage(4, 2_000, 2_008.42, 10.71);
    expect(collapsed).toBeLessThan(COVERAGE.watchInterestCoverage);

    const gone = interestCoverage(2.5, 2_000, 2_008.42, 10.71);
    expect(gone).toBeLessThan(COVERAGE.criticalInterestCoverage);
    expect(coverageState(gone)).toBe('negative-amortizing');
  });

  it('classifies each coverage band', () => {
    expect(coverageState(104)).toBe('healthy');
    expect(coverageState(3)).toBe('healthy');
    expect(coverageState(2.2)).toBe('thin');
    expect(coverageState(1.2)).toBe('impaired');
    expect(coverageState(0.4)).toBe('negative-amortizing');
  });

  it('projects payback from routed revenue', () => {
    expect(projectedPayback(2_008.42, 450, 2_000)).toBe(23);
    expect(projectedPayback(0, 450, 2_000)).toBe(0);
    expect(projectedPayback(1_000, 0, 2_000)).toBeNull();
  });
});

describe('routed coverage', () => {
  it('classifies against the PRD §11.5 thresholds', () => {
    expect(routedCoverageState(0.98)).toBe('consistent');
    expect(routedCoverageState(0.9)).toBe('minor');
    expect(routedCoverageState(0.71)).toBe('material');
    expect(routedCoverageState(0.31)).toBe('diversion');
  });
});

describe('vault', () => {
  it('charges no exit fee below the kink and 1% at 95%', () => {
    expect(withdrawalFeeRate(0.3388)).toBe(0);
    expect(withdrawalFeeRate(0.8)).toBe(0);
    expect(withdrawalFeeRate(0.85)).toBeCloseTo(0.0033, 4);
    expect(withdrawalFeeRate(0.9)).toBeCloseTo(0.0067, 4);
    expect(withdrawalFeeRate(0.95)).toBe(VAULT.feeMax);
    expect(withdrawalFeeRate(0.99)).toBe(VAULT.feeMax);
  });

  it('serves a small withdrawal immediately', () => {
    const plan = planWithdrawal(5_000, 16_530, 25_000, 0.3388);
    expect(plan.bufferFloor).toBe(3_750);
    expect(plan.availableNow).toBe(12_780);
    expect(plan.immediate).toBe(5_000);
    expect(plan.queued).toBe(0);
    expect(plan.fee).toBe(0);
  });

  it('queues the part that would breach the buffer floor', () => {
    const plan = planWithdrawal(18_000, 16_530, 25_000, 0.3388);
    expect(plan.immediate).toBe(12_780);
    expect(plan.queued).toBe(5_220);
    expect(plan.immediate + plan.queued).toBe(18_000);
  });

  it('applies losses in the mandated order', () => {
    const { layers, unabsorbed } = applyLossWaterfall(4_238.1, [
      { label: 'Repayments in flight', available: 112.4 },
      { label: 'Borrower loss reserve', available: 284 },
      { label: 'Borrower security bond', available: 840 },
      { label: 'Protocol first-loss tranche', available: 2_500 },
      { label: 'Protocol loss reserve', available: 412.6 },
      { label: 'Liquidity providers', available: Infinity },
    ]);

    expect(layers[0]?.absorbed).toBe(112.4);
    expect(layers[3]?.absorbed).toBe(2_500);
    expect(layers[5]?.absorbed).toBeCloseTo(89.1, 2);
    expect(unabsorbed).toBe(0);
  });
});

describe('quoteDraw', () => {
  const base = {
    available: 530,
    status: 'ACTIVE' as const,
    tier: 'Strong' as const,
    owed: 2_008.42,
    dailyRevenue: 450,
    repaymentBps: 2_000,
    borrowerRatePct: 10.71,
    vaultLiquidity: 16_530,
    vaultAssets: 25_000,
    bindingOk: true,
    destinationAllowed: true,
    categoryAllowed: true,
    humanApprovalThreshold: 250,
  };

  it('permits a draw inside available credit', () => {
    const quote = quoteDraw({ ...base, amount: 400 });
    expect(quote.permitted).toBe(true);
    expect(quote.needsHumanApproval).toBe(true);
    expect(quote.originationFee).toBeCloseTo(1, 6);
  });

  it('refuses a draw above available credit', () => {
    const quote = quoteDraw({ ...base, amount: 900 });
    expect(quote.permitted).toBe(false);
    expect(quote.checks.find((c) => c.key === 'available')?.pass).toBe(false);
  });

  it('refuses a draw when the endpoint binding is broken', () => {
    const quote = quoteDraw({ ...base, amount: 100, bindingOk: false });
    expect(quote.permitted).toBe(false);
    expect(quote.checks.find((c) => c.key === 'binding')?.pass).toBe(false);
  });

  it('refuses a draw for a restricted borrower', () => {
    const quote = quoteDraw({ ...base, amount: 100, status: 'RESTRICTED' });
    expect(quote.permitted).toBe(false);
  });

  it('does not block on an advisory exposure breach', () => {
    // 2,408 against a 25,000 vault is 9.6%, above the 5% cap. Per screens.md
    // S-54 the consequence is a frozen limit, not a refused draw.
    const quote = quoteDraw({ ...base, amount: 400 });
    const exposure = quote.checks.find((c) => c.key === 'exposure');
    expect(exposure?.pass).toBe(false);
    expect(exposure?.severity).toBe('advisory');
    expect(quote.permitted).toBe(true);
  });

  it('refuses a draw that would breach the liquidity buffer', () => {
    const quote = quoteDraw({
      ...base,
      amount: 500,
      available: 5_000,
      vaultLiquidity: 4_000,
      vaultAssets: 25_000,
    });
    expect(quote.checks.find((c) => c.key === 'buffer')?.pass).toBe(false);
    expect(quote.permitted).toBe(false);
  });

  it('refuses a zero draw', () => {
    expect(quoteDraw({ ...base, amount: 0 }).permitted).toBe(false);
  });
});

describe('format', () => {
  it('renders USDC with two decimals and separators', () => {
    expect(usdc(13_500)).toBe('13,500.00');
    expect(usdc(0)).toBe('0.00');
    expect(usdc(2_008.4159)).toBe('2,008.42');
  });

  it('signs percentage deltas with a true minus', () => {
    expect(signedPct(35)).toBe('+35%');
    expect(signedPct(-22)).toBe('−22%');
  });

  it('truncates addresses 6+4 and leaves truncated input alone', () => {
    expect(shortAddress('0x9c4e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c1')).toBe('0x9c4e…b9c1');
    expect(shortAddress('0x9c4e…a7f1')).toBe('0x9c4e…a7f1');
  });
});
