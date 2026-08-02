import type { ProtocolSnapshot } from '@rivora/api-client';
import { beforeEach, describe, expect, it } from 'vitest';

import { derive } from './derive';
import { applySnapshot, initialState } from './state';
import { useProtocol } from './store';

/** Zustand's `persist` reaches for sessionStorage; give it one under Node. */
const memoryStorage = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
})();
(globalThis as unknown as { sessionStorage: typeof memoryStorage }).sessionStorage = memoryStorage;

/**
 * A server snapshot at simulated day 60 — the same moment the fixtures
 * describe, written out here so the client can be tested without a backend.
 */
function snapshot(overrides: Partial<ProtocolSnapshot> = {}): ProtocolSnapshot {
  return {
    borrower: {
      id: '0x9c4e…a7f1',
      status: 'ACTIVE',
      tier: 'Strong',
      score: 78,
      previousScore: 68,
      limit: 2_530,
      previousLimit: 1_690,
      principal: 2_000,
      accruedInterest: 8.42,
      pendingDraws: 0,
      reserve: 248.6,
      reserveTarget: 253,
      repaymentBps: 2_000,
      reserveBps: 200,
      completedCycles: 1,
      historyDays: 60,
      custody: 'A',
      watchReason: '',
      restrictReason: '',
      anomalyDetected: false,
    },
    revenue: {
      eligible: 13_500,
      gross: 14_040,
      excluded: 540,
      dailyMean: 450,
      growthPct: 35,
      largestPayerPct: 14,
      hhi: 0.14,
      uniquePayers: 386,
      repeatPayers: 168,
    },
    health: {
      coverageRatio: 0.98,
      uptimePct: 99.4,
      successPct: 96.2,
      refundRatePct: 0.9,
      latencyMs: 184,
      bindingOk: true,
      endpointUp: true,
      factors: { S: 0.95, C: 0.86, V: 0.9, D: 0.95, M: 0.88, G: 1.1 },
    },
    vault: {
      totalAssets: 25_000,
      availableLiquidity: 16_530,
      protocolReserve: 412.6,
      firstLossTranche: 2_500,
      queueTotal: 0,
      realizedLosses: 0,
      activeBorrowers: 7,
      onWatch: 1,
      routedRevenue30d: 41_280,
      principalRepaid: 6_190,
      interestGenerated: 184.2,
      sharePrice: 1.007597,
    },
    lp: {
      address: '0x8e11…4c73',
      walletBalance: 12_400,
      supplied: 5_000,
      shares: 4_962.31,
      queued: 0,
      queueFunded: 0,
    },
    events: [
      { time: '14:31:02', type: 'repayment.completed', who: '0x9c4e…a7f1', amount: '90.00 USDC', tx: '0x4a71…9f30' },
    ],
    alerts: [{ time: '12:47', icon: '✓', title: 'Limit increased', unread: true }],
    meta: { day: 60, network: 'Arc Testnet', asOf: '2026-08-02T14:31:07.000Z' },
    ...overrides,
  };
}

const reset = () => useProtocol.setState(initialState());

describe('applySnapshot', () => {
  beforeEach(reset);

  it('flattens the wire contract into the shape the screens read', () => {
    const s = { ...initialState(), ...applySnapshot(snapshot()) };

    expect(s.score).toBe(78);
    expect(s.principal).toBe(2_000);
    expect(s.eligibleRevenue).toBe(13_500);
    expect(s.vaultLiquidity).toBe(16_530);
    expect(s.lpWallet).toBe(12_400);
    expect(s.sharePrice).toBeCloseTo(1.007597, 6);
    expect(s.factors.G).toBe(1.1);
    expect(s.asOf).toBe('2026-08-02T14:31:07.000Z');
  });

  it('maps the event and alert streams onto their view names', () => {
    const s = { ...initialState(), ...applySnapshot(snapshot()) };

    expect(s.events[0]?.type).toBe('repayment.completed');
    expect(s.notifications[0]?.title).toBe('Limit increased');
  });

  it('leaves client-owned state untouched', () => {
    const patch = applySnapshot(snapshot());

    // Drafts, modals and onboarding belong to the client; a sync that reset
    // them would clear a half-typed amount every 30 seconds.
    expect(patch).not.toHaveProperty('drawAmount');
    expect(patch).not.toHaveProperty('modal');
    expect(patch).not.toHaveProperty('onboarding');
    expect(patch).not.toHaveProperty('persona');
  });

  it('carries a restriction through to the derived borrowing gate', () => {
    const restricted = snapshot();
    const s = {
      ...initialState(),
      ...applySnapshot({
        ...restricted,
        borrower: {
          ...restricted.borrower,
          status: 'RESTRICTED',
          limit: 0,
          restrictReason: 'binding',
          anomalyDetected: true,
        },
      }),
    };

    expect(s.anomalyDetected).toBe(true);
    expect(derive(s).canBorrow).toBe(false);
  });
});

describe('initial state', () => {
  beforeEach(reset);

  it('starts empty rather than with plausible figures', () => {
    // A screen showing numbers it never received from the server is worse than
    // one showing an obvious nothing — only the second reads as "not loaded".
    const s = useProtocol.getState();
    expect(s.sync).toBe('idle');
    expect(s.score).toBe(0);
    expect(s.principal).toBe(0);
    expect(s.events).toHaveLength(0);
  });
});

describe('session', () => {
  beforeEach(reset);

  it('starts anonymous, with no role and no token', () => {
    const s = useProtocol.getState();

    expect(s.authStatus).toBe('anonymous');
    expect(s.token).toBeNull();
    expect(s.persona).toBeNull();
  });

  it('signing out clears the token, the user and the role together', () => {
    // A role left behind after the token is gone would render a borrower's
    // chrome over an API that answers 401 to everything.
    useProtocol.setState({
      token: 'jwt',
      tokenExpiresAt: Date.now() + 60_000,
      user: { address: '0xabc', role: 'borrower', home: '/dashboard', known: true },
      authStatus: 'authenticated',
      persona: 'borrower',
    });

    useProtocol.getState().signOut();
    const s = useProtocol.getState();

    expect(s.token).toBeNull();
    expect(s.tokenExpiresAt).toBeNull();
    expect(s.user).toBeNull();
    expect(s.persona).toBeNull();
    expect(s.authStatus).toBe('anonymous');
  });
});

describe('derive', () => {
  beforeEach(reset);

  it('returns a stable reference for the same state', () => {
    const s = useProtocol.getState();
    expect(derive(s)).toBe(derive(s));
  });

  it('moves protocol-wide outstanding with the borrower principal', () => {
    useProtocol.setState(applySnapshot(snapshot()));
    const before = derive(useProtocol.getState()).outstandingProtocolWide;

    const next = snapshot();
    useProtocol.setState(
      applySnapshot({ ...next, borrower: { ...next.borrower, principal: 2_400 } }),
    );

    expect(derive(useProtocol.getState()).outstandingProtocolWide).toBe(before + 400);
  });
});
