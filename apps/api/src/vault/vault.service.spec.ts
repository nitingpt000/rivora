import { describe, expect, it, vi } from 'vitest';

import type { LedgerService } from '../ledger/ledger.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SnapshotService } from '../snapshot/snapshot.service';
import { makeState, makeTxClient } from '../testing/ledger-fixture';
import { VaultService } from './vault.service';
import { WebhookEmitter } from '../webhook/webhook-emitter.service';

function build(state = makeState()) {
  const tx = makeTxClient();

  const snapshots = {
    loadState: vi.fn(async () => state),
    recentEvents: vi.fn(async () => []),
    recentAlerts: vi.fn(async () => []),
    project: vi.fn(() => ({ meta: { day: 60 } })),
  } as unknown as SnapshotService;

  const ledger = {
    run: vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(tx.client)),
    nextTxHash: vi.fn(async () => '0xtest…hash'),
    recordEvent: vi.fn(async () => undefined),
    recordAlert: vi.fn(async () => undefined),
  } as unknown as LedgerService;

  // `performance()` aggregates across every credit line, which the fake
  // transaction client already answers with the seeded book total.
  const prisma = tx.client as unknown as PrismaService;

  return {
    service: new VaultService(snapshots, ledger, prisma, { emit: vi.fn(async () => undefined) } as unknown as WebhookEmitter),
    tx,
  };
}

describe('deposit', () => {
  it('mints shares at the current share price and grows the vault', async () => {
    const { service, tx } = build();

    const result = await service.deposit(5_000);

    expect(tx.written('vaultState', 'totalAssets')).toBe(30_000);
    expect(tx.written('vaultState', 'availableLiquidity')).toBe(21_530);
    expect(tx.written('lpPosition', 'walletBalance')).toBe(7_400);
    // 5,000 / 1.007597 ≈ 4,962.30 shares.
    expect(result.receipt.shares).toBeCloseTo(4_962.3, 1);
  });

  it('refuses a deposit above the wallet balance', async () => {
    const { service } = build(makeState({ lpWalletBalance: 100 }));

    await expect(service.deposit(5_000)).rejects.toMatchObject({
      response: { code: 'insufficient_balance' },
    });
  });
});

describe('withdraw', () => {
  it('serves a small withdrawal immediately with no queue', async () => {
    const { service } = build();

    const result = await service.withdraw(1_000);

    expect(result.receipt.queued).toBe(0);
    expect(result.receipt.amount).toBeCloseTo(1_000, 6);
  });

  it('queues the part that would breach the liquidity buffer', async () => {
    // Free liquidity just above the floor, so a full exit cannot be served.
    const { service, tx } = build(makeState({ availableLiquidity: 4_000 }));

    const result = await service.withdraw(5_000);

    expect(result.receipt.queued).toBeGreaterThan(0);
    expect(tx.written('vaultState', 'queueTotal')).toBeCloseTo(result.receipt.queued ?? 0, 6);
  });

  /**
   * The exit fee is the providers who stayed being paid by the one who left.
   * If the book falls by the whole gross amount, the fee is charged to the
   * leaver and credited to nobody — the vault is smaller than the money that
   * actually moved, and every remaining share is worth less than it should
   * be. The dialog and the vault contract both promise the opposite.
   */
  it('keeps the exit fee in the book rather than destroying it', async () => {
    // High utilization puts the withdrawal past the fee threshold.
    const { service, tx } = build(makeState({ availableLiquidity: 4_000 }));

    const before = 25_000;
    const walletBefore = 12_400;

    await service.withdraw(3_000);

    const paidToProvider = (tx.written('lpPosition', 'walletBalance') as number) - walletBefore;
    const leftTheBook = before - (tx.written('vaultState', 'totalAssets') as number);

    // Exactly what left the provider's side is what left the book.
    expect(leftTheBook).toBeCloseTo(paidToProvider, 6);
    // And a fee was actually charged, or this asserts nothing.
    expect(paidToProvider).toBeLessThan(3_000);
  });

  it('caps a withdrawal at the position value', async () => {
    const { service } = build();

    const result = await service.withdraw(10_000_000);
    const positionValue = 4_962.31 * 1.007597;

    expect((result.receipt.amount ?? 0) + (result.receipt.queued ?? 0)).toBeCloseTo(
      positionValue,
      0,
    );
  });

  it('refuses when there is no position', async () => {
    const { service } = build(makeState({ lpShares: 0 }));

    await expect(service.withdraw(100)).rejects.toMatchObject({
      response: { code: 'no_position' },
    });
  });
});

describe('exit queue', () => {
  it('claiming moves the funded portion to the wallet', async () => {
    const { service, tx } = build(makeState({ lpQueued: 1_000, lpQueueFunded: 400 }));

    await service.claimQueue();

    expect(tx.written('lpPosition', 'walletBalance')).toBe(12_800);
    expect(tx.written('lpPosition', 'queued')).toBe(600);
    expect(tx.written('lpPosition', 'queueFunded')).toBe(0);
  });

  it('refuses to claim when nothing is funded', async () => {
    const { service } = build(makeState({ lpQueued: 1_000, lpQueueFunded: 0 }));

    await expect(service.claimQueue()).rejects.toMatchObject({
      response: { code: 'nothing_to_claim' },
    });
  });

  it('cancelling returns the queued amount as shares', async () => {
    const { service, tx } = build(makeState({ lpQueued: 1_000, lpShares: 4_000 }));

    await service.cancelQueue();

    // 1,000 / 1.007597 ≈ 992.46 shares restored on top of the 4,000 held.
    expect(tx.written('lpPosition', 'shares')).toBeCloseTo(4_992.46, 1);
    expect(tx.written('lpPosition', 'queued')).toBe(0);
  });

  it('refuses to cancel when nothing is queued', async () => {
    const { service } = build();

    await expect(service.cancelQueue()).rejects.toMatchObject({
      response: { code: 'nothing_queued' },
    });
  });
});

describe('VaultService.economics', () => {
  const vault = {
    totalAssets: 25_000,
    availableLiquidity: 16_530,
    firstLossTranche: 2_500,
    realizedLosses: 0,
    interestGenerated: 184.2,
    subsidyApyPct: 2.92,
    subsidyEnds: new Date('2099-01-01T00:00:00.000Z'),
    protocolSpreadPct: 3,
    // Only the fields `economics` reads. Through `unknown` because the row type
    // carries a dozen columns this calculation never touches.
  } as unknown as Parameters<typeof VaultService.economics>[0];

  it('quotes a borrower rate in percent, not in hundreds of percent', () => {
    // `borrowerRate` already returns a percentage. Scaling it again produced a
    // 1,371% rate and a 453% APY that read as plausible-looking large numbers.
    const result = VaultService.economics(vault, 8_470, 22);

    expect(result.blendedBorrowerRatePct).toBeGreaterThan(5);
    expect(result.blendedBorrowerRatePct).toBeLessThan(30);
    expect(result.displayedApyPct).toBeLessThan(30);
  });

  it('earns organic yield only on the deployed share of assets', () => {
    const idle = VaultService.economics(vault, 0, 0);
    const deployed = VaultService.economics(vault, 8_470, 22);

    expect(idle.organicApyPct).toBe(0);
    expect(deployed.organicApyPct).toBeGreaterThan(0);
  });

  it('reports the displayed APY as organic plus subsidy', () => {
    const result = VaultService.economics(vault, 8_470, 22);

    expect(result.displayedApyPct).toBeCloseTo(result.organicApyPct + result.subsidyApyPct, 2);
  });

  it('drops the subsidy once its end date has passed', () => {
    const expired = { ...vault, subsidyEnds: new Date('2020-01-01T00:00:00.000Z') };
    const result = VaultService.economics(expired, 8_470, 22);

    expect(result.subsidyApyPct).toBe(0);
    expect(result.displayedApyPct).toBe(result.organicApyPct);
  });
});
