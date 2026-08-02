import { describe, expect, it, vi } from 'vitest';

import { LedgerError } from '../common/ledger.error';
import type { PrismaService } from '../prisma/prisma.service';
import { makeState } from '../testing/ledger-fixture';
import { SnapshotService } from './snapshot.service';

function build(rows: {
  borrower?: unknown;
  vault?: unknown;
  lp?: unknown;
  events?: unknown[];
  alerts?: unknown[];
}) {
  const prisma = {
    borrower: { findFirst: vi.fn(async () => rows.borrower ?? null) },
    vaultState: { findUnique: vi.fn(async () => rows.vault ?? null) },
    lpPosition: { findFirst: vi.fn(async () => rows.lp ?? null) },
    activityEvent: { findMany: vi.fn(async () => rows.events ?? []) },
    alert: { findMany: vi.fn(async () => rows.alerts ?? []) },
  } as unknown as PrismaService;

  return new SnapshotService(prisma);
}

describe('project', () => {
  const service = build({});
  const state = makeState();

  it('converts stored decimals into wire numbers', async () => {
    const snapshot = service.project(state, [], []);

    expect(snapshot.borrower.principal).toBe(2_000);
    expect(snapshot.borrower.accruedInterest).toBe(8.42);
    expect(snapshot.vault.totalAssets).toBe(25_000);
    expect(snapshot.vault.sharePrice).toBeCloseTo(1.007597, 6);
    expect(snapshot.lp.shares).toBeCloseTo(4_962.31, 2);
  });

  it('exposes the borrower by public handle, never by row id', async () => {
    // The internal cuid is not a protocol identity and must not leak.
    const snapshot = service.project(state, [], []);

    expect(snapshot.borrower.id).toBe('0x9c4e…a7f1');
    expect(JSON.stringify(snapshot)).not.toContain('borrower-1');
  });

  it('flattens the six quality factors', async () => {
    const snapshot = service.project(state, [], []);

    expect(snapshot.health.factors).toEqual({
      S: 0.95,
      C: 0.86,
      V: 0.9,
      D: 0.95,
      M: 0.88,
      G: 1.1,
    });
  });

  it('stamps the moment the snapshot was produced', async () => {
    const snapshot = service.project(state, [], []);

    expect(snapshot.meta.network).toBe('Arc Testnet');
    expect(snapshot.meta.day).toBe(60);
    expect(Date.parse(snapshot.meta.asOf)).not.toBeNaN();
  });
});

describe('loadState', () => {
  it('fails with an actionable message when nothing is seeded', async () => {
    const service = build({});

    await expect(service.loadState()).rejects.toThrow(LedgerError);
    await expect(service.loadState()).rejects.toMatchObject({
      response: { code: 'not_seeded', error: expect.stringContaining('db:seed') },
    });
  });

  it('fails when the borrower exists but its credit line does not', async () => {
    const service = build({
      borrower: { id: 'b1', creditLine: null, revenueWindow: null, health: null },
      vault: {},
      lp: {},
    });

    await expect(service.loadState()).rejects.toMatchObject({
      response: { code: 'not_seeded' },
    });
  });
});

describe('event stream', () => {
  it('formats times as UTC time of day and drops empty notes', async () => {
    const service = build({
      events: [
        {
          at: new Date('2026-08-02T14:31:02.000Z'),
          type: 'repayment.completed',
          who: '0x9c4e…a7f1',
          amount: '90.00 USDC',
          txHash: '0x4a71…9f30',
          note: null,
        },
      ],
    });

    const events = await service.recentEvents();

    expect(events[0]).toEqual({
      time: '14:31:02',
      type: 'repayment.completed',
      who: '0x9c4e…a7f1',
      amount: '90.00 USDC',
      tx: '0x4a71…9f30',
    });
    expect(events[0]).not.toHaveProperty('note');
  });
});
