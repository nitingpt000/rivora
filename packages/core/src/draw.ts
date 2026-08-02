import {
  COVERAGE,
  ORIGINATION_FEE_PCT,
  TIER_MAX_HORIZON_DAYS,
  UNDERWRITING,
  VAULT,
} from './constants';
import { days, num, pct, usdc } from './format';
import { interestForDays } from './rates';
import { interestCoverage, projectedPayback } from './repayment';
import { bufferFloor } from './vault';
import type { BorrowerStatus, DrawCheck, Tier } from './types';

export interface DrawContext {
  amount: number;
  available: number;
  status: BorrowerStatus;
  tier: Tier;
  owed: number;
  dailyRevenue: number;
  repaymentBps: number;
  borrowerRatePct: number;
  vaultLiquidity: number;
  vaultAssets: number;
  bindingOk: boolean;
  destinationAllowed: boolean;
  categoryAllowed: boolean;
  /** Agent-wallet threshold above which an owner signature is required. */
  humanApprovalThreshold: number;
}

export interface DrawQuote {
  checks: DrawCheck[];
  /** True when every *blocking* check passes. Advisory failures do not gate. */
  permitted: boolean;
  needsHumanApproval: boolean;
  principal: number;
  originationFee: number;
  estimatedInterest: number;
  estimatedTotal: number;
  postCoverage: number;
  postPaybackDays: number | null;
  postBufferPct: number;
}

/**
 * Evaluates a draw request against every protocol and policy precondition.
 *
 * Interest coverage is a hard precondition rather than a warning — PRD §15.5
 * puts the check in the Credit Manager, not offchain, so the UI must model it
 * the same way or the two will disagree.
 */
export function quoteDraw(ctx: DrawContext): DrawQuote {
  const amount = Number.isFinite(ctx.amount) ? Math.max(0, ctx.amount) : 0;
  const postOwed = ctx.owed + amount;

  const postCoverage = interestCoverage(
    ctx.dailyRevenue,
    ctx.repaymentBps,
    postOwed,
    ctx.borrowerRatePct,
  );
  const postPaybackDays = projectedPayback(postOwed, ctx.dailyRevenue, ctx.repaymentBps);
  const maxHorizon = TIER_MAX_HORIZON_DAYS[ctx.tier];
  const postLiquidity = ctx.vaultLiquidity - amount;
  const postBufferPct = ctx.vaultAssets > 0 ? (postLiquidity / ctx.vaultAssets) * 100 : 0;

  const borrowable = ['ACTIVE', 'ELIGIBLE', 'REPAID'].includes(ctx.status);

  const checks: DrawCheck[] = [
    {
      key: 'status',
      label: 'Credit line is active',
      detail: `status ${ctx.status}`,
      value: ctx.status,
      pass: borrowable,
      severity: 'blocking',
    },
    {
      key: 'available',
      label: 'Within available credit',
      detail: `available ${usdc(ctx.available)}`,
      value: usdc(amount),
      pass: amount > 0 && amount <= ctx.available,
      severity: 'blocking',
    },
    {
      key: 'buffer',
      label: 'Vault liquidity buffer holds',
      detail: `floor ${pct(VAULT.bufferFloorPct * 100, 0)}`,
      value: pct(postBufferPct, 1),
      pass: postLiquidity >= bufferFloor(ctx.vaultAssets),
      severity: 'blocking',
    },
    {
      key: 'exposure',
      label: 'Per-borrower exposure after draw',
      detail: `cap ${pct(UNDERWRITING.exposureCapPct * 100, 0)} of vault assets`,
      value: pct(ctx.vaultAssets > 0 ? (postOwed / ctx.vaultAssets) * 100 : 0, 2),
      pass: ctx.vaultAssets > 0 && postOwed <= ctx.vaultAssets * UNDERWRITING.exposureCapPct,
      severity: 'advisory',
    },
    {
      key: 'destination',
      label: 'Destination is allowed',
      detail: 'registered operating wallet',
      value: ctx.destinationAllowed ? 'allowed' : 'not allowlisted',
      pass: ctx.destinationAllowed,
      severity: 'blocking',
    },
    {
      key: 'category',
      label: 'Category permitted by wallet policy',
      detail: 'agent spending policy',
      value: ctx.categoryAllowed ? 'permitted' : 'blocked',
      pass: ctx.categoryAllowed,
      severity: 'blocking',
    },
    {
      key: 'binding',
      label: 'Revenue Router active, binding probe passing',
      detail: 'payTo matches bound router',
      value: ctx.bindingOk ? 'passing' : 'MISMATCH',
      pass: ctx.bindingOk,
      severity: 'blocking',
    },
    {
      key: 'coverage',
      label: 'Interest coverage after draw',
      detail: `required ≥ ${COVERAGE.minInterestCoverageForDraw.toFixed(1)}`,
      value: Number.isFinite(postCoverage) ? num(postCoverage, 1) : '—',
      pass: postCoverage >= COVERAGE.minInterestCoverageForDraw,
      severity: 'blocking',
    },
    {
      key: 'payback',
      label: 'Projected payback after draw',
      detail: `max ${maxHorizon} days (${ctx.tier})`,
      value: days(postPaybackDays),
      pass: postPaybackDays !== null && postPaybackDays <= maxHorizon,
      severity: 'blocking',
    },
  ];

  const originationFee = amount * ORIGINATION_FEE_PCT;
  const estimatedInterest = interestForDays(amount, ctx.borrowerRatePct, postPaybackDays ?? 0);

  return {
    checks,
    permitted: amount > 0 && checks.every((c) => c.severity === 'advisory' || c.pass),
    needsHumanApproval: amount > ctx.humanApprovalThreshold,
    principal: amount,
    originationFee,
    estimatedInterest,
    estimatedTotal: amount + originationFee + estimatedInterest,
    postCoverage,
    postPaybackDays,
    postBufferPct,
  };
}
