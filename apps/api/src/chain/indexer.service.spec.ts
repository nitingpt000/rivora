import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { LedgerService } from '../ledger/ledger.service';
import type { PrismaService } from '../prisma/prisma.service';
import { IndexerService, type ChainLogSource, type ObservedLog } from './indexer.service';

/**
 * The behaviour pinned here is the reconciliation judgement: which logs are
 * money, which divergences alarm, how the cursor moves, and that a replay
 * changes nothing. The RPC and Postgres are both faked — the judgement is
 * decided before either is reached.
 */

function config(mode = 'arc', fromBlock: number | null = null): ConfigService {
  const values: Record<string, unknown> = {
    chainMode: mode,
    arcIndexerFromBlock: fromBlock,
    arcIndexerIntervalMs: 15_000,
    arcRpcUrl: 'https://example.invalid',
    creditVaultAddress: '0xv',
    creditManagerAddress: '0xm',
    riskRegistryAddress: '0xr',
  };
  return { get: (key: string) => values[key] } as ConfigService;
}

function log(overrides: Partial<ObservedLog> = {}): ObservedLog {
  return {
    blockNumber: 100n,
    logIndex: 0,
    txHash: '0x' + 'ab'.repeat(32),
    address: '0xm',
    name: 'Drawn',
    args: { borrowerId: '0x' + '11'.repeat(32), amount: 3_000_000n, recipient: '0xc8' },
    ...overrides,
  };
}

/**
 * A Prisma fake that holds the three tables the indexer touches. The $transaction
 * callback receives the fake itself, which is exactly how the real client behaves
 * for this use.
 */
function fakePrisma(options: { ledgerHashes?: string[]; alerts?: { txHash: string; title: string }[] } = {}) {
  const chainEvents: Record<string, unknown>[] = [];
  const alerts: { txHash: string; title: string }[] = [...(options.alerts ?? [])];
  let sync: { id: string; lastBlock: bigint } | null = null;
  const ledgerHashes = new Set(options.ledgerHashes ?? []);
  const activityRows: { txHash: string; at: Date }[] = [...ledgerHashes].map((txHash) => ({
    txHash,
    at: new Date(Date.now() - 10 * 60 * 1000),
  }));

  const client = {
    chainSync: {
      findUnique: vi.fn(async () => sync),
      create: vi.fn(async ({ data }: { data: { id: string; lastBlock: bigint } }) => {
        sync = { ...data };
        return sync;
      }),
      update: vi.fn(async ({ data }: { data: { lastBlock: bigint } }) => {
        sync = { id: 'singleton', lastBlock: data.lastBlock };
        return sync;
      }),
    },
    chainEvent: {
      create: vi.fn(async ({ data }: { data: { txHash: string; logIndex: number } }) => {
        if (
          chainEvents.some(
            (row) => row.txHash === data.txHash && row.logIndex === data.logIndex,
          )
        ) {
          const cause = new Error('unique') as Error & { code: string };
          cause.code = 'P2002';
          throw cause;
        }
        chainEvents.push(data);
        return data;
      }),
      findFirst: vi.fn(async ({ where }: { where: { txHash: string } }) => {
        const row = chainEvents.find((event) => event.txHash === where.txHash);
        return row ? { id: 'ce' } : null;
      }),
    },
    activityEvent: {
      findFirst: vi.fn(async ({ where }: { where: { txHash: string } }) =>
        ledgerHashes.has(where.txHash) ? { id: 'ae' } : null,
      ),
      findMany: vi.fn(async () => activityRows),
    },
    alert: {
      findFirst: vi.fn(async ({ where }: { where: { txHash: string; title: string } }) =>
        alerts.find((a) => a.txHash === where.txHash && a.title === where.title) ?? null,
      ),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };

  return { client: client as unknown as PrismaService, chainEvents, alerts, cursor: () => sync };
}

function fakeLedger(alerts: { txHash: string; title: string }[]): LedgerService {
  return {
    recordAlert: vi.fn(async (_client: unknown, input: { txHash?: string; title: string }) => {
      alerts.push({ txHash: input.txHash ?? '', title: input.title });
    }),
  } as unknown as LedgerService;
}

function source(latest: bigint, logs: ObservedLog[]): ChainLogSource {
  return {
    latestBlock: vi.fn(async () => latest),
    logs: vi.fn(async () => logs),
  };
}

describe('cursor initialisation', () => {
  it('starts at the tip when no from-block is configured', async () => {
    const prisma = fakePrisma();
    const service = new IndexerService(
      config('arc', null),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(500n, []),
    );

    await service.tick();
    expect(prisma.cursor()?.lastBlock).toBe(500n);
    expect(prisma.chainEvents).toHaveLength(0);
  });

  it('starts at the configured block so history is indexed', async () => {
    const prisma = fakePrisma();
    const src = source(500n, [log({ blockNumber: 450n })]);
    const service = new IndexerService(
      config('arc', 450),
      prisma.client,
      fakeLedger(prisma.alerts),
      src,
    );

    await service.tick();
    expect(src.logs).toHaveBeenCalledWith(450n, 500n);
    expect(prisma.chainEvents).toHaveLength(1);
    expect(prisma.cursor()?.lastBlock).toBe(500n);
  });
});

describe('reconciliation judgement', () => {
  it('matches a money event whose hash a ledger row carries', async () => {
    const hash = '0x' + 'cd'.repeat(32);
    const prisma = fakePrisma({ ledgerHashes: [hash] });
    const service = new IndexerService(
      config('arc', 100),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(100n, [log({ txHash: hash, blockNumber: 100n })]),
    );

    await service.tick();
    expect(prisma.chainEvents[0]!.reconciled).toBe('matched');
    expect(prisma.alerts.filter((a) => a.title.includes('no ledger record'))).toHaveLength(0);
  });

  it('alarms on a money event no ledger row carries', async () => {
    const prisma = fakePrisma();
    const service = new IndexerService(
      config('arc', 100),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(100n, [log({ name: 'Deposited', address: '0xv' })]),
    );

    await service.tick();
    expect(prisma.chainEvents[0]!.reconciled).toBe('unmatched');
    expect(prisma.alerts.some((a) => a.title === 'Onchain event with no ledger record')).toBe(true);
  });

  it('stores bookkeeping events without judging them', async () => {
    const prisma = fakePrisma();
    const service = new IndexerService(
      config('arc', 100),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(100n, [log({ name: 'InterestAccrued' }), log({ name: 'StatusChanged', logIndex: 1 })]),
    );

    await service.tick();
    expect(prisma.chainEvents.map((event) => event.reconciled)).toEqual(['recorded', 'recorded']);
    expect(prisma.alerts).toHaveLength(0);
  });

  it('serialises bigint arguments before they reach the Json column', async () => {
    const prisma = fakePrisma();
    const service = new IndexerService(
      config('arc', 100),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(100n, [log({ name: 'InterestAccrued' })]),
    );

    await service.tick();
    const args = prisma.chainEvents[0]!.args as Record<string, unknown>;
    expect(args.amount).toBe('3000000');
    expect(typeof args.recipient).toBe('string');
  });

  it('a replayed log changes nothing and alarms nothing', async () => {
    const prisma = fakePrisma();
    const entry = log({ name: 'Deposited' });
    const service = new IndexerService(
      config('arc', 100),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(100n, [entry]),
    );

    await service.tick();
    const alertsAfterFirst = prisma.alerts.length;

    // Same log arrives again — a crash between recording and cursor advance.
    const replay = new IndexerService(
      config('arc', 100),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(100n, [entry]),
    );
    // Force the cursor back so the block is re-fetched.
    await (prisma.client as unknown as { chainSync: { update: (a: unknown) => Promise<unknown> } }).chainSync.update({
      data: { lastBlock: 99n },
    });
    await replay.tick();

    expect(prisma.chainEvents).toHaveLength(1);
    expect(prisma.alerts).toHaveLength(alertsAfterFirst);
  });
});

describe('reverse check', () => {
  it('alarms once for a real-hash ledger row the chain never showed', async () => {
    const hash = '0x' + 'ef'.repeat(32);
    const prisma = fakePrisma({ ledgerHashes: [hash] });
    const service = new IndexerService(
      config('arc', null),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(500n, []),
    );

    await service.tick();
    expect(prisma.alerts.filter((a) => a.title === 'Ledger record with no onchain event')).toHaveLength(1);

    // The next pass sees the alert already exists and stays quiet.
    await service.tick();
    expect(prisma.alerts.filter((a) => a.title === 'Ledger record with no onchain event')).toHaveLength(1);
  });

  it('ignores ledger-mode stand-in hashes', async () => {
    const prisma = fakePrisma({ ledgerHashes: ['0x4a71…9f30'] });
    const service = new IndexerService(
      config('arc', null),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(500n, []),
    );

    await service.tick();
    expect(prisma.alerts).toHaveLength(0);
  });
});

describe('mode gate', () => {
  it('reports disabled and never starts in ledger mode', async () => {
    const prisma = fakePrisma();
    const service = new IndexerService(
      config('ledger'),
      prisma.client,
      fakeLedger(prisma.alerts),
      source(500n, []),
    );

    service.onApplicationBootstrap();
    expect(await service.snapshot()).toEqual({ enabled: false, lastBlock: null, latest: null });
    service.onApplicationShutdown();
  });
});
