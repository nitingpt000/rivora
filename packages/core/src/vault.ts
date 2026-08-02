import { VAULT } from './constants';
import type { WithdrawalPlan } from './types';

/** Liquidity that must remain in the vault at all times. PRD §23.3. */
export function bufferFloor(totalAssets: number): number {
  return totalAssets * VAULT.bufferFloorPct;
}

/** Current buffer as a share of total assets. */
export function bufferRatio(availableLiquidity: number, totalAssets: number): number {
  if (totalAssets <= 0) return 0;
  return availableLiquidity / totalAssets;
}

/** Whether a draw of `amount` would breach the buffer floor. PRD §23.3. */
export function drawWouldBreachBuffer(
  amount: number,
  availableLiquidity: number,
  totalAssets: number,
): boolean {
  return availableLiquidity - amount < bufferFloor(totalAssets);
}

/**
 * Utilization-linked exit fee. PRD §23.5.
 *
 * Deliberately small. It removes the advantage of exiting first, which is what
 * causes runs; it is not meant to trap capital. A fee large enough to genuinely
 * lock LPs in makes the shares hard to distinguish from a closed-end fund.
 */
export function withdrawalFeeRate(u: number): number {
  const { feeStartUtilization: start, feeEndUtilization: end, feeMax } = VAULT;
  if (u <= start) return 0;
  if (u >= end) return feeMax;
  return (feeMax * (u - start)) / (end - start);
}

/**
 * Splits a withdrawal into what is served now and what enters the FIFO queue.
 * PRD §23.4.
 */
export function planWithdrawal(
  requested: number,
  availableLiquidity: number,
  totalAssets: number,
  currentUtilization: number,
): WithdrawalPlan {
  const floor = bufferFloor(totalAssets);
  const availableNow = Math.max(0, availableLiquidity - floor);
  const immediate = Math.min(requested, availableNow);
  const queued = Math.max(0, requested - immediate);
  const fee = immediate * withdrawalFeeRate(currentUtilization);

  return { requested, immediate, queued, fee, bufferFloor: floor, availableNow };
}

/**
 * Estimated days to clear a queued position, from the trailing repayment rate.
 *
 * The loan book amortizes continuously rather than at maturity, which is the
 * property that makes an epoch queue workable here at all — roughly 2.2% of
 * outstanding principal returns every day without any borrower action. PRD §23.2.
 */
export function queueClearanceDays(queuedAmount: number, aheadInQueue = 0): number | null {
  if (queuedAmount <= 0) return 0;
  const rate = VAULT.queueFundingRatePerDay;
  if (rate <= 0) return null;
  return Math.ceil((queuedAmount + aheadInQueue) / rate);
}

/** Share price from total assets and shares outstanding. */
export function sharePrice(totalAssets: number, sharesOutstanding: number): number {
  if (sharesOutstanding <= 0) return 1;
  return totalAssets / sharesOutstanding;
}

/** Shares minted for a deposit. */
export function sharesForDeposit(amount: number, price: number): number {
  if (price <= 0) return amount;
  return amount / price;
}

/**
 * Applies a realized loss across the capital structure. PRD §18.2 / §23.6.
 *
 * Order matters and is not negotiable: borrower reserve, then the protocol
 * first-loss tranche, then the protocol reserve, and only then LP shares.
 */
export interface LossLayer {
  label: string;
  available: number;
  absorbed: number;
  remaining: number;
}

export function applyLossWaterfall(
  loss: number,
  layers: Array<{ label: string; available: number }>,
): { layers: LossLayer[]; unabsorbed: number } {
  let outstanding = loss;
  const result: LossLayer[] = layers.map((layer) => {
    const absorbed = Math.min(outstanding, layer.available);
    outstanding -= absorbed;
    return {
      label: layer.label,
      available: layer.available,
      absorbed,
      remaining: outstanding,
    };
  });
  return { layers: result, unabsorbed: outstanding };
}
