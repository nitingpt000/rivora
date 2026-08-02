import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyRepayment, availableCredit, planWithdrawal, utilization } from '@rivora/core';

/**
 * Generates the differential fixtures.
 *
 * Runs the *real* `@rivora/core` functions — the ones the web app uses to show
 * a borrower what a draw or repayment will do — and writes their outputs for
 * `test/Differential.t.sol` to assert against. That test is the only thing
 * stopping the preview a borrower consents to and the arithmetic that
 * executes onchain from drifting apart.
 *
 * Committing hand-written expected values instead would defeat the purpose:
 * they would encode what someone believed the TypeScript did, not what it
 * does.
 *
 * Values cross the boundary scaled to USDC's six decimals, because Solidity
 * has no floats. Every input is chosen to be exact at 6dp so the comparison
 * is not measuring float error.
 */

/** USDC units per whole token. */
const SCALE = 1_000_000;

/** Scales a decimal USDC amount to integer base units. */
function toBase(value: number): string {
  return BigInt(Math.round(value * SCALE)).toString();
}

interface RepaymentCase {
  label: string;
  amount: string;
  principal: string;
  accruedInterest: string;
  expectedApplied: string;
  expectedToInterest: string;
  expectedToPrincipal: string;
  expectedExcess: string;
  expectedClearsDebt: boolean;
}

/**
 * Every input is exact to the cent, deliberately.
 *
 * `@rivora/core` rounds its outputs to two decimals — it is the library behind
 * what a borrower is *shown*, and money is displayed in cents. The chain
 * settles at USDC's six decimals. The two therefore cannot agree below a cent,
 * and feeding sub-cent amounts in would be testing that mismatch rather than
 * the arithmetic.
 *
 * Sub-cent behaviour is covered separately, on the chain's own terms, by
 * `test/RivoraMath.t.sol`.
 */
const repaymentInputs: Array<[label: string, amount: number, principal: number, interest: number]> =
  [
    ['partial, interest first', 500, 2_000, 8.42],
    ['exactly the interest', 8.42, 2_000, 8.42],
    ['less than the interest', 5, 2_000, 8.42],
    ['clears the debt exactly', 2_008.42, 2_000, 8.42],
    ['overpayment is capped', 10_000, 2_000, 8.42],
    ['no interest outstanding', 100, 500, 0],
    ['one cent', 0.01, 2_000, 8.42],
    ['large balance', 250_000, 1_000_000, 12_345.68],
  ];

const repaymentCases: RepaymentCase[] = repaymentInputs.map(
  ([label, amount, principal, interest]) => {
    const result = applyRepayment(amount, principal, interest);

    return {
      label,
      amount: toBase(amount),
      principal: toBase(principal),
      accruedInterest: toBase(interest),
      expectedApplied: toBase(result.amount),
      expectedToInterest: toBase(result.toInterest),
      expectedToPrincipal: toBase(result.toPrincipal),
      expectedExcess: toBase(result.excess),
      expectedClearsDebt: result.clearsDebt,
    };
  },
);

interface AvailableCase {
  label: string;
  limit: string;
  principal: string;
  pendingDraws: string;
  expected: string;
}

const availableInputs: Array<[label: string, limit: number, principal: number, pending: number]> = [
  ['headroom remaining', 2_530, 2_000, 0],
  ['pending draws reduce it', 2_530, 2_000, 100],
  ['fully drawn', 2_530, 2_530, 0],
  ['principal above limit saturates at zero', 1_690, 2_000, 0],
  ['nothing drawn', 2_530, 0, 0],
  ['zero limit', 0, 0, 0],
];

const availableCases: AvailableCase[] = availableInputs.map(
  ([label, limit, principal, pending]) => ({
    label,
    limit: toBase(limit),
    principal: toBase(principal),
    pendingDraws: toBase(pending),
    expected: toBase(availableCredit(limit, principal, pending)),
  }),
);

interface WithdrawalCase {
  label: string;
  requested: string;
  availableLiquidity: string;
  totalAssets: string;
  utilizationBps: string;
  expectedImmediate: string;
  expectedQueued: string;
  expectedBufferFloor: string;
  expectedAvailableNow: string;
}

const withdrawalInputs: Array<
  [label: string, requested: number, liquidity: number, assets: number, outstanding: number]
> = [
  ['served in full', 1_000, 16_530, 25_000, 8_470],
  ['partially queued at the buffer floor', 5_000, 4_000, 25_000, 8_470],
  ['fully queued, liquidity at the floor', 2_000, 3_750, 25_000, 21_250],
  ['large vault, small exit', 10_000, 400_000, 1_000_000, 600_000],
  ['empty book', 500, 10_000, 10_000, 0],
];

const withdrawalCases: WithdrawalCase[] = withdrawalInputs.map(
  ([label, requested, liquidity, assets, outstanding]) => {
    const util = utilization(outstanding, liquidity);
    const plan = planWithdrawal(requested, liquidity, assets, util);

    return {
      label,
      requested: toBase(requested),
      availableLiquidity: toBase(liquidity),
      totalAssets: toBase(assets),
      utilizationBps: String(Math.round(util * 10_000)),
      expectedImmediate: toBase(plan.immediate),
      expectedQueued: toBase(plan.queued),
      expectedBufferFloor: toBase(plan.bufferFloor),
      expectedAvailableNow: toBase(plan.availableNow),
    };
  },
);

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');
mkdirSync(target, { recursive: true });

const document = {
  note: 'Generated by script/generate-fixtures.ts from @rivora/core. Do not edit by hand.',
  scale: SCALE,
  // Counts are explicit because Foundry's JSON path parser has no `.length`,
  // and a test that silently iterated zero cases would pass while asserting
  // nothing at all.
  repaymentCount: repaymentCases.length,
  availableCount: availableCases.length,
  withdrawalCount: withdrawalCases.length,
  repayment: repaymentCases,
  available: availableCases,
  withdrawal: withdrawalCases,
};

writeFileSync(join(target, 'core.json'), `${JSON.stringify(document, null, 2)}\n`);

console.log(
  `fixtures: wrote ${repaymentCases.length} repayment, ${availableCases.length} available and ${withdrawalCases.length} withdrawal cases`,
);
