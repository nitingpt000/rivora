import { Prisma } from '@prisma/client';
import type { BorrowerStatus, Tier } from '@rivora/core';
import { vi } from 'vitest';

import type { LedgerState } from '../snapshot/snapshot.service';

/**
 * Test doubles for the ledger.
 *
 * The services are unit-tested against a fake transaction client rather than a
 * live database: the behaviour worth pinning down is the arithmetic and the
 * refusals, and both are decided before any SQL is generated. A test that
 * needs Postgres to prove `applyRepayment` puts interest first is testing
 * Postgres.
 */

const D = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

export interface FixtureOverrides {
  status?: BorrowerStatus;
  tier?: Tier;
  limit?: number;
  principal?: number;
  accruedInterest?: number;
  pendingDraws?: number;
  availableLiquidity?: number;
  totalAssets?: number;
  lpWalletBalance?: number;
  lpShares?: number;
  lpQueued?: number;
  lpQueueFunded?: number;
  sharePrice?: number;
  dailyMean?: number;
}

/** The canonical day-60 position, adjustable per test. */
export function makeState(overrides: FixtureOverrides = {}): LedgerState {
  const {
    status = 'ACTIVE',
    tier = 'Strong',
    limit = 2_530,
    principal = 2_000,
    accruedInterest = 8.42,
    pendingDraws = 0,
    availableLiquidity = 16_530,
    totalAssets = 25_000,
    lpWalletBalance = 12_400,
    lpShares = 4_962.31,
    lpQueued = 0,
    lpQueueFunded = 0,
    sharePrice = 1.007597,
    dailyMean = 450,
  } = overrides;

  const now = new Date('2026-08-02T14:31:07.000Z');

  return {
    id: 'borrower-1',
    handle: '0x9c4e…a7f1',
    serviceName: 'QuoteStream Market Data API',
    category: 'Data lookup and static datasets',
    endpoint: 'https://api.quotestream.dev/v1',
    endpointHash: '0x3b7d…e922',
    routerAddress: '0x7f3a…c1d2',
    operatingWallet: '0x2b18…9e04',
    ownerWallet: '0x5d92…3ba6',
    custody: 'A',
    operator: 'QuoteStream Labs Ltd',
    jurisdiction: 'Singapore',
    kybVerifiedAt: now,
    registeredAt: now,
    creditLine: {
      id: 'credit-1',
      borrowerId: 'borrower-1',
      status,
      tier,
      score: 78,
      previousScore: 68,
      limitAmount: D(limit),
      previousLimit: D(1_690),
      restrictedFromLimit: null,
      principal: D(principal),
      accruedInterest: D(accruedInterest),
      pendingDraws: D(pendingDraws),
      reserve: D(248.6),
      reserveTarget: D(253),
      repaymentBps: 2_000,
      reserveBps: 200,
      completedCycles: 1,
      historyDays: 60,
      watchReason: '',
      restrictReason: '',
      anomalyDetected: false,
      principalRepaid: D(6_190),
      updatedAt: now,
    },
    revenueWindow: {
      id: 'revenue-1',
      borrowerId: 'borrower-1',
      eligible: D(13_500),
      gross: D(14_040),
      excluded: D(540),
      dailyMean: D(dailyMean),
      growthPct: 35,
      largestPayerPct: 14,
      hhi: 0.14,
      uniquePayers: 386,
      repeatPayers: 168,
      windowStart: now,
      windowEnd: now,
      updatedAt: now,
    },
    health: {
      id: 'health-1',
      borrowerId: 'borrower-1',
      coverageRatio: 0.98,
      uptimePct: 99.4,
      successPct: 96.2,
      refundRatePct: 0.9,
      latencyMs: 184,
      bindingOk: true,
      endpointUp: true,
      factorS: 0.95,
      factorC: 0.86,
      factorV: 0.9,
      factorD: 0.95,
      factorM: 0.88,
      factorG: 1.1,
      updatedAt: now,
    },
    vault: {
      id: 'singleton',
      totalAssets: D(totalAssets),
      availableLiquidity: D(availableLiquidity),
      protocolReserve: D(412.6),
      firstLossTranche: D(2_500),
      queueTotal: D(0),
      realizedLosses: D(0),
      activeBorrowers: 7,
      onWatch: 1,
      routedRevenue30d: D(41_280),
      principalRepaid: D(6_190),
      interestGenerated: D(184.2),
      sharePrice: D(sharePrice),
      day: 60,
      updatedAt: now,
    },
    lp: {
      id: 'lp-1',
      address: '0x8e11…4c73',
      walletBalance: D(lpWalletBalance),
      supplied: D(5_000),
      shares: D(lpShares),
      queued: D(lpQueued),
      queueFunded: D(lpQueueFunded),
      depositedAt: now,
      updatedAt: now,
    },
  } as LedgerState;
}

export interface UpdateCall {
  model: string;
  data: Record<string, unknown>;
}

/**
 * A fake transaction client that records writes instead of performing them.
 *
 * `outstandingPrincipal` aggregates across every credit line, so the fake
 * answers that query with the seeded book total rather than zero — otherwise
 * utilization would read as 0% and the withdrawal planner would never queue.
 */
export function makeTxClient(
  seededBook = 8_470,
  policy: Partial<{
    maxPayment: number;
    maxDaily: number;
    spentToday: number;
    humanApprovalThreshold: number;
    allowedCategories: string[];
    blockedCategories: string[];
  }> = {},
) {
  const updates: UpdateCall[] = [];

  const record = (model: string) =>
    vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      updates.push({ model, data });
      return data;
    });

  const client = {
    creditLine: {
      update: record('creditLine'),
      aggregate: vi.fn(async () => ({ _sum: { principal: new Prisma.Decimal(seededBook) } })),
    },
    vaultState: { update: record('vaultState') },
    lpPosition: { update: record('lpPosition') },
    activityEvent: {
      count: vi.fn(async () => 8),
      create: record('activityEvent'),
      findMany: vi.fn(async () => []),
    },
    alert: { create: record('alert'), findMany: vi.fn(async () => []) },
    // The agent spending policy the draw path enforces. Defaults are the
    // schema's, so a test that says nothing about policy gets the same
    // permissive-but-real limits a freshly registered borrower has.
    agentPolicy: {
      findUnique: vi.fn(async () => ({
        id: 'policy-1',
        borrowerId: 'borrower-1',
        maxPayment: new Prisma.Decimal(policy.maxPayment ?? 100),
        maxDaily: new Prisma.Decimal(policy.maxDaily ?? 500),
        spentToday: new Prisma.Decimal(policy.spentToday ?? 0),
        humanApprovalThreshold: new Prisma.Decimal(policy.humanApprovalThreshold ?? 250),
        allowedCategories: policy.allowedCategories ?? [],
        blockedCategories: policy.blockedCategories ?? [],
        updatedAt: new Date(),
      })),
      create: record('agentPolicy'),
      update: record('agentPolicy'),
    },
    policyDecision: { create: record('policyDecision') },
  };

  const find = (model: string, key: string): unknown =>
    updates.find((u) => u.model === model && key in u.data)?.data[key];

  return {
    client: client as unknown as Prisma.TransactionClient,
    updates,
    /** Last written value of a field, as a number. */
    written(model: string, key: string): number | undefined {
      const value = find(model, key);
      if (value === undefined) return undefined;
      return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
    },
    /** Raw written value, for non-numeric fields. */
    raw(model: string, key: string): unknown {
      return find(model, key);
    },
    events(): Record<string, unknown>[] {
      return updates.filter((u) => u.model === 'activityEvent').map((u) => u.data);
    },
  };
}
