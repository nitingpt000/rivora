import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LedgerChainService } from '../chain/chain.service';
import { LedgerError } from '../common/ledger.error';
import type { LedgerService } from '../ledger/ledger.service';
import type { SnapshotService } from '../snapshot/snapshot.service';
import { makeState, makeTxClient } from '../testing/ledger-fixture';
import { CreditService } from './credit.service';

/**
 * The behaviour worth pinning down is the arithmetic and the refusals. Both
 * are decided before any SQL is generated, so these run against a fake
 * transaction client rather than a live database.
 */
function build(
  state = makeState(),
  policy: Parameters<typeof makeTxClient>[1] = { maxPayment: 100_000, maxDaily: 100_000 },
) {
  const tx = makeTxClient(8_470, policy);

  const snapshots = {
    loadState: vi.fn(async () => state),
    recentEvents: vi.fn(async () => []),
    recentAlerts: vi.fn(async () => []),
    project: vi.fn(() => ({ meta: { day: 60 } })),
  } as unknown as SnapshotService;

  const ledger = {
    run: vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(tx.client)),
    nextTxHash: vi.fn(async () => '0xtest…hash'),
    recordEvent: vi.fn(async (client: unknown, input: unknown) => {
      await (client as { activityEvent: { create: (a: unknown) => Promise<unknown> } }).activityEvent.create({
        data: input,
      });
    }),
    recordAlert: vi.fn(async () => undefined),
  } as unknown as LedgerService;

  return {
    service: new CreditService(snapshots, ledger, new LedgerChainService()),
    tx,
    snapshots,
    ledger,
  };
}

describe('draw', () => {
  it('moves principal and vault liquidity together', async () => {
    const { service, tx } = build();

    const result = await service.draw(400, 'Compute');

    expect(tx.written('creditLine', 'principal')).toBe(2_400);
    expect(tx.written('vaultState', 'availableLiquidity')).toBe(16_130);
    expect(result.receipt).toMatchObject({ kind: 'draw', amount: 400 });
  });

  it('refuses to overdraw rather than silently clamping', async () => {
    // Clamping is what the old client did; it meant a borrower who asked for
    // 99,999 saw a success receipt for a very different number.
    const { service, tx } = build();

    await expect(service.draw(99_999, 'Compute')).rejects.toThrow(LedgerError);
    expect(tx.written('creditLine', 'principal')).toBeUndefined();
  });

  it('names the shortfall in the refusal', async () => {
    const { service } = build();

    await expect(service.draw(99_999, 'Compute')).rejects.toMatchObject({
      response: { code: 'exceeds_available', error: expect.stringContaining('530.00') },
    });
  });

  it('draws exactly the available credit', async () => {
    const { service, tx } = build();

    await service.draw(530, 'Compute');

    expect(tx.written('creditLine', 'principal')).toBe(2_530);
  });

  it('blocks a draw while the account is restricted', async () => {
    const { service } = build(makeState({ status: 'RESTRICTED', limit: 0 }));

    await expect(service.draw(100, 'Compute')).rejects.toMatchObject({
      response: { code: 'draws_blocked' },
    });
  });

  it('refuses when the vault cannot fund it', async () => {
    const { service } = build(makeState({ availableLiquidity: 100 }));

    await expect(service.draw(400, 'Compute')).rejects.toMatchObject({
      response: { code: 'insufficient_liquidity' },
    });
  });

  it('records the category against the event', async () => {
    const { service, tx } = build();

    await service.draw(100, 'Storage');

    expect(tx.events()[0]).toMatchObject({
      type: 'credit.draw.completed',
      note: 'Storage',
      amount: '100.00 USDC',
    });
  });
});

describe('repay', () => {
  it('applies interest before principal', async () => {
    const { service, tx } = build();

    await service.repay(500);

    expect(tx.written('creditLine', 'accruedInterest')).toBe(0);
    // 500 − 8.42 of interest leaves 491.58 against principal.
    expect(tx.written('creditLine', 'principal')).toBeCloseTo(2_000 - 491.58, 6);
  });

  it('returns interest and principal to the vault', async () => {
    const { service, tx } = build();

    await service.repay(500);

    expect(tx.written('vaultState', 'availableLiquidity')).toBeCloseTo(16_530 + 500, 6);
  });

  it('caps a repayment at the amount owed', async () => {
    const { service } = build();

    const result = await service.repay(10_000);

    expect(result.receipt.amount).toBeCloseTo(2_008.42, 6);
  });

  it('marks the loan repaid and banks a completed cycle', async () => {
    const { service, tx } = build();

    const result = await service.repay(2_008.42);

    expect(result.receipt.clearsDebt).toBe(true);
    expect(tx.raw('creditLine', 'status')).toBe('REPAID');
    expect(tx.raw('creditLine', 'completedCycles')).toBe(2);
  });

  it('does not mark REPAID while the account is restricted', async () => {
    // Clearing the balance does not clear the restriction that caused it.
    const { service, tx } = build(makeState({ status: 'RESTRICTED' }));

    await service.repay(2_008.42);

    expect(tx.raw('creditLine', 'status')).toBeUndefined();
  });

  it('refuses when there is no debt', async () => {
    const { service } = build(makeState({ principal: 0, accruedInterest: 0 }));

    await expect(service.repay(100)).rejects.toMatchObject({ response: { code: 'no_debt' } });
  });
});

describe('capacity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is the limit less principal and anything already pending', () => {
    expect(CreditService.capacityOf(makeState())).toBe(530);
    expect(CreditService.capacityOf(makeState({ pendingDraws: 100 }))).toBe(430);
  });

  it('never reports negative capacity', () => {
    expect(CreditService.capacityOf(makeState({ principal: 3_000 }))).toBe(0);
  });
});

/**
 * The agent spending policy, enforced.
 *
 * These limits were stored, displayed and editable for the whole of the
 * product's life while `draw` consulted none of them — the category argument
 * reached the ledger as a log string and nothing else. A cap nobody checks is
 * a claim, not a control.
 */
describe('spending policy', () => {
  it('refuses a draw above the single-payment limit', async () => {
    const { service, tx } = build(makeState(), { maxPayment: 100, maxDaily: 100_000 });

    await expect(service.draw(400, 'Compute')).rejects.toMatchObject({
      code: 'exceeds_max_payment',
    });
    // Nothing moved.
    expect(tx.written('creditLine', 'principal')).toBeUndefined();
  });

  it('refuses a draw that would pass the daily cap', async () => {
    const { service } = build(makeState(), {
      maxPayment: 100_000,
      maxDaily: 500,
      spentToday: 450,
    });

    await expect(service.draw(100, 'Compute')).rejects.toMatchObject({
      code: 'exceeds_daily_cap',
    });
  });

  it('refuses a blocked category', async () => {
    const { service } = build(makeState(), {
      maxPayment: 100_000,
      maxDaily: 100_000,
      blockedCategories: ['Gambling'],
    });

    await expect(service.draw(50, 'Gambling')).rejects.toMatchObject({
      code: 'category_blocked',
    });
  });

  it('refuses a category outside a configured allow-list', async () => {
    const { service } = build(makeState(), {
      maxPayment: 100_000,
      maxDaily: 100_000,
      allowedCategories: ['Compute', 'Storage'],
    });

    await expect(service.draw(50, 'Marketing')).rejects.toMatchObject({
      code: 'category_blocked',
    });
  });

  it('records the decision and adds to the day when it allows one', async () => {
    const { service, tx } = build(makeState(), {
      maxPayment: 100_000,
      maxDaily: 100_000,
      spentToday: 120,
    });

    await service.draw(80, 'Compute');

    expect(tx.raw('policyDecision', 'outcome')).toBe('allowed');
    expect(tx.written('agentPolicy', 'spentToday')).toBe(200);
  });
});
