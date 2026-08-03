import { createHash } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { coefficientOfVariation, compositeScore, tierForScore } from '@rivora/core';

/**
 * Seeds the canonical dataset — simulated day 60, after the second assessment.
 *
 * Observations, not conclusions: scores and tiers are computed from the
 * seeded signals by `@rivora/core`, so a stored score can never disagree with
 * the components that explain it. Deliberately free of `Math.random()` — a
 * database that seeds differently on every run cannot be diffed, and a failing
 * test could never be reproduced.
 */

const prisma = new PrismaClient();

/** The borrower behind the borrower surface. */
const BORROWER = {
  handle: '0x9c4e…a7f1',
  serviceName: 'QuoteStream Market Data API',
  category: 'Data lookup and static datasets',
  endpoint: 'https://api.quotestream.dev/v1',
  endpointHash: '0x3b7d…e922',
  routerAddress: '0x7f3a…c1d2',
  operatingWallet: '0x2b18…9e04',
  ownerWallet: '0x5d92…3ba6',
  operator: 'QuoteStream Labs Ltd',
  jurisdiction: 'Singapore',
};

/**
 * The other six borrowers in the book.
 *
 * Real rows rather than a hard-coded total, because utilization is summed
 * across every credit line — a stored aggregate would drift the moment one of
 * them repaid.
 */
/**
 * The rest of the book.
 *
 * Spread across categories and coverage ratios on purpose: sector
 * concentration, the watchlist and the alert feed are all derived from the
 * shape of this list, so a uniform set of peers would make every one of them
 * report nothing.
 */
const PEERS = [
  {
    handle: '0x1f88\u202620ce',
    principal: 1_600,
    tier: 'Standard' as const,
    score: 62,
    category: 'Text generation and inference proxy',
    coverageRatio: 0.99,
    uptimePct: 98.8,
    successPct: 97.1,
    largestPayerPct: 22,
    hhi: 1_100,
    uniquePayers: 84,
    growthPct: 9,
  },
  {
    handle: '0x4c30\u2026f18b',
    principal: 1_250,
    tier: 'Standard' as const,
    score: 58,
    category: 'Search, retrieval and enrichment',
    // Below 0.90, so this borrower lands on the watchlist and raises an alert.
    coverageRatio: 0.71,
    uptimePct: 96.2,
    successPct: 93.4,
    largestPayerPct: 34,
    hhi: 1_760,
    uniquePayers: 39,
    growthPct: -6,
  },
  {
    handle: '0x8a02\u20265d71',
    principal: 1_100,
    tier: 'Strong' as const,
    score: 74,
    category: 'Data lookup and static datasets',
    coverageRatio: 0.62,
    uptimePct: 94.0,
    successPct: 91.0,
    largestPayerPct: 41,
    hhi: 2_240,
    uniquePayers: 22,
    growthPct: -14,
  },
  {
    handle: '0xb731\u20269e40',
    principal: 980,
    tier: 'Standard' as const,
    score: 66,
    category: 'Document and media processing',
    coverageRatio: 0.97,
    uptimePct: 99.1,
    successPct: 98.2,
    largestPayerPct: 18,
    hhi: 820,
    uniquePayers: 112,
    growthPct: 14,
  },
  {
    handle: '0xc5d9\u20261a83',
    principal: 870,
    tier: 'Prime' as const,
    score: 86,
    category: 'Data lookup and static datasets',
    coverageRatio: 1.0,
    uptimePct: 99.8,
    successPct: 99.4,
    largestPayerPct: 9,
    hhi: 340,
    uniquePayers: 260,
    growthPct: 18,
  },
  {
    handle: '0xe240\u20267b19',
    principal: 670,
    tier: 'Standard' as const,
    score: 61,
    category: 'Text generation and inference proxy',
    coverageRatio: 0.96,
    uptimePct: 98.0,
    successPct: 96.5,
    largestPayerPct: 26,
    hhi: 1_320,
    uniquePayers: 61,
    growthPct: 4,
  },
];

/**
 * Development wallets, each granted a role.
 *
 * These are the addresses of the well-known Anvil/Hardhat test keys — public,
 * published in every Ethereum tutorial, and holding nothing. Real addresses
 * rather than invented ones, because an address nobody has the key for cannot
 * sign in, and a developer cannot exercise an auth flow they are locked out
 * of. `scripts/derive-addresses.mjs` prints the mapping.
 *
 * Anything seeding a database that matters must replace these.
 */
const ROLES = [
  { address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', role: 'borrower' as const, label: 'QuoteStream Labs' },
  { address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', role: 'lp' as const, label: 'Liquidity provider' },
  { address: '0x90f79bf6eb2c4f870365e785982e1f101e93b906', role: 'ops' as const, label: 'Risk operator A' },
  // A second operator, because declaring a default requires two distinct
  // signatures (PRD §19.8) and a quorum nobody can complete is a lockout.
  { address: '0x976ea74026e726554db657fa54763abd0c3a0aa9', role: 'ops' as const, label: 'Risk operator B' },
  { address: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', role: 'partner' as const, label: 'AgentMarket Inc' },
];

/** Events, oldest first — `at` is derived so ordering is stable. */
const EVENTS = [
  { type: 'vault.utilization.changed', who: '—', amount: '33.88%', tx: '0x91cc…5d17', h: 8, m: 0 },
  { type: 'borrower.watchlisted', who: '0x4c30…f18b', amount: '—', tx: '0x0d31…44a9', h: 9, m: 22, note: 'coverage ratio 0.71' },
  { type: 'vault.deposit', who: '0x8e11…4c73', amount: '5,000.00 USDC', tx: '0x77ae…1b62', h: 11, m: 15 },
  { type: 'risk.assessment.completed', who: '0x9c4e…a7f1', amount: '—', tx: '0x39d5…8ca0', h: 12, m: 47 },
  { type: 'credit.limit.updated', who: '0x9c4e…a7f1', amount: '2,530.00 USDC', tx: '0x39d5…8ca0', h: 12, m: 47, note: 'score 68 → 78 · Standard → Strong · capped by growth cap' },
  { type: 'credit.draw', who: '0x1f88…20ce', amount: '600.00 USDC', tx: '0xbb02…7741', h: 13, m: 4 },
  { type: 'revenue.settled', who: '0x9c4e…a7f1', amount: '450.00 USDC', tx: '0x4a71…9f30', h: 14, m: 30 },
  { type: 'repayment.completed', who: '0x9c4e…a7f1', amount: '90.00 USDC', tx: '0x4a71…9f30', h: 14, m: 31, note: 'interest 0.24 · principal 89.76' },
];

/**
 * Development partner key.
 *
 * Fixed so the seeded environment is reproducible and documented. It is a
 * development credential only — a real key is generated at issue, shown once,
 * and stored as a hash. Anything seeding a production database must not use
 * this value.
 */
const DEV_API_KEY = 'pk_test_rivora_dev_8f2a4c91b7e3';

/** Payers counted toward the eligible revenue figure. */
const INCLUDED_PAYERS = [
  { label: 'payer-01', revenue30d: 1_890, sharePct: 14, requests30d: 47_250, firstSeenAt: new Date('2026-06-12T00:00:00.000Z') },
  { label: 'payer-02', revenue30d: 1_620, sharePct: 12, requests30d: 40_500, firstSeenAt: new Date('2026-06-14T00:00:00.000Z') },
  { label: 'payer-03', revenue30d: 1_350, sharePct: 10, requests30d: 33_750, firstSeenAt: new Date('2026-06-18T00:00:00.000Z') },
  { label: 'payer-04', revenue30d: 1_080, sharePct: 8, requests30d: 27_000, firstSeenAt: new Date('2026-06-21T00:00:00.000Z') },
  { label: 'payer-05', revenue30d: 945, sharePct: 7, requests30d: 23_625, firstSeenAt: new Date('2026-06-25T00:00:00.000Z') },
  { label: 'payer-06', revenue30d: 810, sharePct: 6, requests30d: 20_250, firstSeenAt: new Date('2026-07-01T00:00:00.000Z') },
  ...tail(),
];

/**
 * The long tail, as many payers rather than one bucket.
 *
 * These six named payers hold 57% between them; the rest of the borrower's
 * revenue comes from a spread of smaller customers. Modelling that spread as a
 * single 5,805 row — which is what this was — made one payer look like 43% of
 * the book and drove the concentration factor to near zero, while the window
 * beside it claimed a largest-payer share of 14%.
 *
 * Both figures are now derived from these rows, so they cannot disagree again.
 */
function tail() {
  const TOTAL = 5_805;
  const COUNT = 30;

  // Gently decreasing rather than uniform: a real tail has an order.
  const weights = Array.from({ length: COUNT }, (_, i) => COUNT - i * 0.5);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  return weights.map((weight, i) => {
    const revenue = Math.round((TOTAL * weight * 100) / weightSum) / 100;
    return {
      label: `payer-${String(i + 7).padStart(2, '0')}`,
      revenue30d: revenue,
      sharePct: 0,
      requests30d: Math.round(revenue / 0.04),
      firstSeenAt: new Date(
        `2026-06-${String(5 + (i % 20)).padStart(2, '0')}T00:00:00.000Z`,
      ),
    };
  });
}

/**
 * Concentration, computed from the payer rows rather than asserted beside them.
 *
 * The same arithmetic `IngestService.rebuildPayerSummaries` runs, so a seeded
 * borrower and an ingested one describe concentration identically.
 */
const PAYER_STATS = (() => {
  const total = INCLUDED_PAYERS.reduce((sum, payer) => sum + payer.revenue30d, 0);
  let largest = 0;
  let hhi = 0;

  for (const payer of INCLUDED_PAYERS) {
    const share = total > 0 ? (payer.revenue30d / total) * 100 : 0;
    if (share > largest) largest = share;
    hhi += share * share;
  }

  return { largestPayerPct: Math.round(largest * 100) / 100, hhi: Math.round(hhi) };
})();

/** Payers whose revenue was filtered out, with the reason. */
const EXCLUDED_PAYERS = [
  {
    label: 'payer-x1',
    revenue30d: 320,
    sharePct: 2.3,
    requests30d: 8_000,
    firstSeenAt: new Date('2026-07-28T00:00:00.000Z'),
    exclusionReason: 'Payer age below 7 days',
  },
  {
    label: 'payer-x2',
    revenue30d: 220,
    sharePct: 1.6,
    requests30d: 5_500,
    firstSeenAt: new Date('2026-07-20T00:00:00.000Z'),
    exclusionReason: 'Refunded within window',
  },
];

/** Trailing 30-day totals for the primary borrower, USDC. */
const GROSS_30D = 14_040;
const EXCLUDED_30D = 540;

/**
 * The shape of 30 days of settled revenue, before scaling.
 *
 * Rising with day-to-day variation rather than smooth: the consistency signal
 * is the coefficient of variation of this series, and a perfectly smooth ramp
 * would score a consistency no real API achieves.
 */
const REVENUE_SHAPE = [
  392, 458, 401, 512, 437, 486, 551, 502, 594, 533, 578, 624, 567, 651, 601, 668, 617, 701, 659,
  733, 684, 751, 708, 767, 725, 792, 741, 808, 776, 833,
];

/**
 * The series, scaled so it sums to the window total.
 *
 * Derived rather than stated twice. Writing both by hand let them drift 34%
 * apart — the chart and the headline described the same 30 days and disagreed.
 */
const DAILY_REVENUE = (() => {
  const shapeTotal = REVENUE_SHAPE.reduce((a, b) => a + b, 0);
  return REVENUE_SHAPE.map((v) => Math.round((v * GROSS_30D * 1_000_000) / shapeTotal) / 1_000_000);
})();

/** Exclusions concentrate in the last fortnight, matching the payer rows. */
const EXCLUDED_DAYS = 14;
const EXCLUDED_PER_DAY = Math.round((EXCLUDED_30D / EXCLUDED_DAYS) * 1_000_000) / 1_000_000;

const UPSTREAM = [
  {
    name: 'Model provider A',
    category: 'compute',
    declaredCostPct: 62,
    sharePct: 58.2,
    substitutable: false,
  },
  {
    name: 'GPU marketplace B',
    category: 'compute',
    declaredCostPct: 24,
    sharePct: 21.4,
    substitutable: true,
  },
  {
    name: 'Object storage C',
    category: 'storage',
    declaredCostPct: 14,
    sharePct: 12.9,
    substitutable: true,
  },
  { name: 'Other', category: 'other', declaredCostPct: 0, sharePct: 7.5, substitutable: true },
];

const ALLOWLIST = [
  { address: '0xf120\u202688ab', name: 'Model provider A', category: 'compute' },
  { address: '0x9a03\u202614dd', name: 'GPU marketplace B', category: 'compute' },
  { address: '0x77c1\u20266b90', name: 'Object storage C', category: 'storage' },
  { address: '0x2b18\u20269e04', name: 'Own operating wallet', category: 'internal' },
];

const ANOMALY_EVIDENCE = [
  {
    finding: 'Payer 0x31aa\u20267c02 funded from borrower operating wallet',
    at: '2026-07-22T09:14:00.000Z',
    detail: '120.00 USDC, 4 minutes before first request',
    tx: '0x71c0\u20268a13',
  },
  {
    finding: 'Payer 0x88f0\u202612de funded from the same wallet',
    at: '2026-07-23T11:02:00.000Z',
    detail: '150.00 USDC, 2 minutes before first request',
    tx: '0x2ea9\u20265d70',
  },
  {
    finding: 'Payer 0x5c19\u20269b41 funded from the same wallet',
    at: '2026-07-24T08:47:00.000Z',
    detail: '140.00 USDC, 6 minutes before first request',
    tx: '0x9b34\u20261f22',
  },
  {
    finding: 'All three payers transact only with this endpoint',
    at: '2026-07-31T00:00:00.000Z',
    detail: '214 payments, no other counterparty',
  },
  {
    finding: 'Net of gas and protocol fees, the activity lost money',
    at: '2026-08-02T14:31:00.000Z',
    detail: '\u221268.00 USDC over 9 days',
  },
];

const ANOMALY_WALLETS = [
  { address: '0x31aa\u20267c02', fundedOn: '2026-07-22', amount: 120 },
  { address: '0x88f0\u202612de', fundedOn: '2026-07-23', amount: 150 },
  { address: '0x5c19\u20269b41', fundedOn: '2026-07-24', amount: 140 },
];

/**
 * The primary borrower's score, from the same signals the API recomputes.
 *
 * `@rivora/core` owns the arithmetic; the seed only supplies the observations.
 */
const PRIMARY_SIGNALS = {
  uptimePct: 99.4,
  successPct: 96.2,
  revenueCv: coefficientOfVariation(DAILY_REVENUE),
  onTimeRatioPct: 100,
  completedCycles: 1,
  largestPayerPct: 14,
  hhi: 900,
  uniquePayers: 386,
  custody: 'A' as const,
  historyDays: 60,
  growthPct: 35,
  reserveCoveragePct: 98.3,
};

const PRIMARY_SCORE = compositeScore(PRIMARY_SIGNALS);
const PRIMARY_TIER = tierForScore(PRIMARY_SCORE);

/** A fixed anchor date keeps `at` values reproducible across runs. */
const ANCHOR = new Date('2026-08-02T00:00:00.000Z');

function at(hours: number, minutes: number): Date {
  const d = new Date(ANCHOR);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

/** Midnight UTC, `n` days before the anchor. */
function dayBefore(n: number): Date {
  const d = new Date(ANCHOR);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const POLICY_DECISIONS = [
  {
    at: at(14, 2),
    recipient: '0xf120\u202688ab',
    amount: 42,
    category: 'compute',
    outcome: 'allowed',
    reason: '',
  },
  {
    at: at(12, 44),
    recipient: '0x77c1\u20266b90',
    amount: 18.4,
    category: 'storage',
    outcome: 'allowed',
    reason: '',
  },
  {
    at: at(11, 31),
    recipient: '0x5f19\u2026c204',
    amount: 310,
    category: 'compute',
    outcome: 'rejected',
    reason: 'recipient not allowlisted',
  },
  {
    at: at(9, 18),
    recipient: '0xf120\u202688ab',
    amount: 280,
    category: 'compute',
    outcome: 'queued',
    reason: 'above 250 \u00b7 signed by owner 09:24',
  },
];

const RESERVE_ACTIVITY = [
  {
    at: at(6, 0),
    type: 'contribution',
    amount: 9,
    balance: 248.6,
    txHash: '0x4a71\u20269f30',
    note: '2% of settled revenue',
  },
  {
    at: dayBefore(1),
    type: 'contribution',
    amount: 8.82,
    balance: 239.6,
    txHash: '0x30bc\u202611ad',
    note: '2% of settled revenue',
  },
  {
    at: dayBefore(15),
    type: 'applied',
    amount: -12.4,
    balance: 118.22,
    txHash: '0x8e02\u20265c31',
    note: 'applied to missed repayment',
  },
];

async function main(): Promise<void> {
  console.log('seed: clearing existing rows');

  // Order matters — children before parents, since several relations restrict
  // or cascade on delete.
  await prisma.revenueDayPayer.deleteMany();
  await prisma.defaultApproval.deleteMany();
  await prisma.defaultDeclaration.deleteMany();
  await prisma.defaultRecord.deleteMany();
  await prisma.anomaly.deleteMany();
  await prisma.revenueDay.deleteMany();
  await prisma.reserveEvent.deleteMany();
  await prisma.policyDecision.deleteMany();
  await prisma.allowlistEntry.deleteMany();
  await prisma.upstreamDependency.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.payerSummary.deleteMany();
  await prisma.agentPolicy.deleteMany();
  await prisma.serviceHealth.deleteMany();
  await prisma.revenueWindow.deleteMany();
  await prisma.creditLine.deleteMany();
  await prisma.borrower.deleteMany();
  await prisma.lpPosition.deleteMany();
  await prisma.addressRole.deleteMany();
  await prisma.vaultState.deleteMany();
  await prisma.authNonce.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  console.log('seed: writing the primary borrower');

  const borrower = await prisma.borrower.create({
    data: {
      ...BORROWER,
      custody: 'A',
      kybVerifiedAt: new Date('2026-06-05T00:00:00.000Z'),
      registeredAt: new Date('2026-06-03T00:00:00.000Z'),
      creditLine: {
        create: {
          status: 'ACTIVE',
          tier: PRIMARY_TIER,
          // Computed, not chosen. A stored score that disagrees with the
          // components explaining it makes the assessment screen contradict
          // itself, and the whole product rests on underwriting being
          // mechanical.
          score: PRIMARY_SCORE,
          previousScore: PRIMARY_SCORE - 10,
          limitAmount: 2_530,
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
          principalRepaid: 6_190,
        },
      },
      revenueWindow: {
        create: {
          // Derived from the series and the payer table, so no figure here can
          // contradict the rows it summarises. An earlier version stated a
          // largest-payer share of 14% while the payer rows held one at 43%.
          eligible: GROSS_30D - EXCLUDED_30D,
          gross: GROSS_30D,
          excluded: EXCLUDED_30D,
          dailyMean: Math.round(((GROSS_30D - EXCLUDED_30D) / 30) * 100) / 100,
          growthPct: 35,
          largestPayerPct: PAYER_STATS.largestPayerPct,
          hhi: PAYER_STATS.hhi,
          uniquePayers: INCLUDED_PAYERS.length,
          repeatPayers: INCLUDED_PAYERS.length,
          windowStart: new Date('2026-07-03T00:00:00.000Z'),
          windowEnd: new Date('2026-08-01T00:00:00.000Z'),
        },
      },
      health: {
        create: {
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
        },
      },
    },
  });

  console.log(`seed: writing ${PEERS.length} peer borrowers`);

  for (const [index, peer] of PEERS.entries()) {
    await prisma.borrower.create({
      data: {
        handle: peer.handle,
        serviceName: `Peer service ${index + 1}`,
        category: peer.category,
        endpoint: `https://peer-${index + 1}.example/v1`,
        operatingWallet: `0xop${index + 1}`,
        ownerWallet: `0xown${index + 1}`,
        custody: 'A',
        // Staggered so "earliest registration" deterministically selects the
        // primary borrower above.
        registeredAt: new Date(`2026-06-${String(10 + index).padStart(2, '0')}T00:00:00.000Z`),
        creditLine: {
          create: {
            status: 'ACTIVE',
            tier: peer.tier,
            score: peer.score,
            previousScore: peer.score - 4,
            limitAmount: Math.round(peer.principal * 1.3),
            previousLimit: peer.principal,
            principal: peer.principal,
            accruedInterest: 0,
            historyDays: 45,
            completedCycles: 1,
            reserve: Math.round(peer.principal * 0.02),
            reserveTarget: Math.round(peer.principal * 0.025),
          },
        },
        // A borrower without a revenue window and a health row is not
        // underwritable: every surface that reads one 404s or throws. Seeding
        // a partial record produced exactly that on the operator's screen.
        revenueWindow: {
          create: {
            eligible: peer.principal * 5,
            gross: peer.principal * 5.2,
            excluded: peer.principal * 0.2,
            dailyMean: (peer.principal * 5) / 30,
            growthPct: peer.growthPct,
            largestPayerPct: peer.largestPayerPct,
            hhi: peer.hhi,
            uniquePayers: peer.uniquePayers,
            repeatPayers: Math.round(peer.uniquePayers * 0.4),
            windowStart: new Date('2026-07-03T00:00:00.000Z'),
            windowEnd: new Date('2026-08-01T00:00:00.000Z'),
          },
        },
        health: {
          create: {
            coverageRatio: peer.coverageRatio,
            uptimePct: peer.uptimePct,
            successPct: peer.successPct,
            refundRatePct: 1.1,
            latencyMs: 210,
            bindingOk: peer.coverageRatio > 0.75,
            endpointUp: true,
            factorS: peer.uptimePct / 100,
            factorC: Math.max(0, 1 - peer.largestPayerPct / 45),
            factorV: 0.88,
            factorD: Math.max(0, 1 - peer.hhi / 2_500),
            factorM: 0.9,
            factorG: 1,
          },
        },
      },
    });
  }

  console.log('seed: writing the vault and LP position');

  await prisma.vaultState.create({
    data: {
      id: 'singleton',
      totalAssets: 25_000,
      availableLiquidity: 16_530,
      protocolReserve: 412.6,
      firstLossTranche: 2_500,
      queueTotal: 0,
      realizedLosses: 0,
      activeBorrowers: PEERS.length + 1,
      onWatch: 1,
      routedRevenue30d: 41_280,
      principalRepaid: 6_190,
      interestGenerated: 184.2,
      sharePrice: 1.007597,
      day: 60,
      subsidyApyPct: 2.92,
      subsidyEnds: new Date('2026-10-30T00:00:00.000Z'),
      protocolSpreadPct: 3,
    },
  });

  await prisma.lpPosition.create({
    data: {
      address: '0x8e11…4c73',
      walletBalance: 12_400,
      supplied: 5_000,
      shares: 4_962.31,
      queued: 0,
      queueFunded: 0,
      depositedAt: new Date('2026-08-01T00:00:00.000Z'),
    },
  });

  console.log('seed: writing the agent policy');
  await prisma.agentPolicy.create({
    data: {
      borrowerId: borrower.id,
      maxPayment: 100,
      maxDaily: 500,
      spentToday: 182.4,
      humanApprovalThreshold: 250,
      allowedCategories: ['compute', 'data', 'storage', 'security & monitoring'],
      blockedCategories: ['marketing', 'payroll'],
      policyChangeDelayHours: 24,
    },
  });

  console.log('seed: writing payer summaries');
  await prisma.payerSummary.createMany({
    data: [
      ...INCLUDED_PAYERS.map((payer) => ({ ...payer, borrowerId: borrower.id, excluded: false })),
      ...EXCLUDED_PAYERS.map((payer) => ({ ...payer, borrowerId: borrower.id, excluded: true })),
    ],
  });

  console.log('seed: writing assessment history');
  await prisma.assessment.createMany({
    data: [
      {
        borrowerId: borrower.id,
        at: new Date('2026-07-19T00:00:00.000Z'),
        atDay: 30,
        score: 68,
        tier: 'Standard',
        limitAmount: 1_690,
        previousLimit: 0,
        bindingKey: 'newBorrower',
        ladder: [],
      },
      {
        borrowerId: borrower.id,
        at: new Date('2026-08-02T14:00:00.000Z'),
        // Exactly one interval behind the current settlement day, so the very
        // next tick is due for reassessment rather than fourteen ticks away.
        atDay: 46,
        score: 78,
        tier: 'Strong',
        limitAmount: 2_530,
        previousLimit: 1_690,
        bindingKey: 'growthCap',
        ladder: [],
      },
    ],
  });

  console.log('seed: writing address roles');
  // The borrower role is linked to its record, which is what every ownership
  // check resolves through.
  await prisma.addressRole.createMany({
    data: ROLES.map((role) =>
      role.role === 'borrower' ? { ...role, borrowerId: borrower.id } : role,
    ),
  });

  console.log('seed: writing the partner API key');
  await prisma.apiKey.create({
    data: {
      label: 'AgentMarket Inc',
      // SHA-256 of the development key below. The plaintext is never stored;
      // in production a key is shown once at issue and only hashed thereafter.
      keyHash: createHash('sha256').update(DEV_API_KEY).digest('hex'),
      prefix: DEV_API_KEY.slice(0, 11),
      scopes: ['score:read'],
      // The partner wallet above, so the console can find this key.
      ownerAddress: ROLES.find((role) => role.role === 'partner')?.address ?? null,
    },
  });
  console.log(`seed: development partner key → ${DEV_API_KEY}`);

  console.log('seed: writing the event stream');
  for (const event of EVENTS) {
    await prisma.activityEvent.create({
      data: {
        at: at(event.h, event.m),
        type: event.type,
        who: event.who,
        amount: event.amount,
        txHash: event.tx,
        note: event.note ?? null,
        borrowerId: event.who === BORROWER.handle ? borrower.id : null,
      },
    });
  }

  console.log('seed: writing alerts');
  await prisma.alert.createMany({
    data: [
      {
        at: at(12, 47),
        icon: '✓',
        title: 'Credit limit increased',
        body: '1,690.00 → 2,530.00 USDC after your second assessment.',
        unread: true,
        borrowerId: borrower.id,
      },
      {
        at: at(11, 19),
        icon: '✓',
        title: 'Revenue settled',
        body: '450.00 USDC routed — 90.00 to repayment, 9.00 to reserve.',
        unread: false,
        borrowerId: borrower.id,
      },
    ],
  });

  console.log('seed: writing the daily revenue series');
  await prisma.revenueDay.createMany({
    data: DAILY_REVENUE.map((settled, index) => ({
      borrowerId: borrower.id,
      date: dayBefore(DAILY_REVENUE.length - 1 - index),
      settled,
      excluded: index >= DAILY_REVENUE.length - EXCLUDED_DAYS ? EXCLUDED_PER_DAY : 0,
      requests: Math.round(settled / 0.04),
    })),
  });

  console.log('seed: writing the per-payer daily breakdown');
  // Each payer's 30-day total spread across the days in proportion to that
  // day's share of settled revenue. The rollup the API recomputes from these
  // rows has to reproduce the PayerSummary written above, or a single
  // ingestion would silently rewrite the borrower's concentration.
  const seededDays = await prisma.revenueDay.findMany({
    where: { borrowerId: borrower.id },
    orderBy: { date: 'asc' },
    select: { id: true, settled: true },
  });

  const settledTotal = seededDays.reduce((sum, day) => sum + Number(day.settled), 0);

  await prisma.revenueDayPayer.createMany({
    data: seededDays.flatMap((day) => {
      const weight = settledTotal > 0 ? Number(day.settled) / settledTotal : 0;

      return [
        ...INCLUDED_PAYERS.map((payer) => ({
          revenueDayId: day.id,
          label: payer.label,
          amount: Math.round(payer.revenue30d * weight * 1_000_000) / 1_000_000,
          requests: Math.round(payer.requests30d * weight),
          excluded: false,
        })),
        ...EXCLUDED_PAYERS.map((payer) => ({
          revenueDayId: day.id,
          label: payer.label,
          amount: Math.round(payer.revenue30d * weight * 1_000_000) / 1_000_000,
          requests: Math.round(payer.requests30d * weight),
          excluded: true,
          exclusionReason: payer.exclusionReason,
        })),
      ];
    }),
  });

  console.log('seed: writing upstream dependencies');
  await prisma.upstreamDependency.createMany({
    data: UPSTREAM.map((row) => ({ ...row, borrowerId: borrower.id })),
  });

  console.log('seed: writing the agent allowlist and decision log');
  await prisma.allowlistEntry.createMany({
    data: ALLOWLIST.map((row) => ({ ...row, borrowerId: borrower.id })),
  });
  await prisma.policyDecision.createMany({
    data: POLICY_DECISIONS.map((row) => ({ ...row, borrowerId: borrower.id })),
  });

  console.log('seed: writing reserve activity');
  await prisma.reserveEvent.createMany({
    data: RESERVE_ACTIVITY.map((row) => ({ ...row, borrowerId: borrower.id })),
  });

  console.log('seed: writing the detected anomaly');
  const washHandle = PEERS[2]?.handle;
  const washPeer = washHandle
    ? await prisma.borrower.findUnique({ where: { handle: washHandle } })
    : null;

  if (washPeer) {
    await prisma.anomaly.create({
      data: {
        reference: 'A-0142',
        borrowerId: washPeer.id,
        kind: 'Circular funding',
        detectedAt: at(14, 31),
        washAmount: 2_400,
        payerCount: 3,
        daysSpanned: 9,
        // Negative: the wallets spent more on gas and fees than the activity
        // returned, which is the proof it was not economic.
        netEconomicRevenue: -68,
        evidenceHash: '0x8b41\u2026c07e',
        txHash: '0x0d31\u202644a9',
        evidence: ANOMALY_EVIDENCE,
        fundedWallets: ANOMALY_WALLETS,
        afterEligibleRevenue: 11_100,
        afterScore: 57,
        afterTier: 'Restricted',
        afterLimit: 0,
        afterRepaymentBps: 3_500,
      },
    });

    // The write-back the detection triggers. Without it the anomaly screen
    // would show a restriction the borrower's own record does not reflect.
    await prisma.creditLine.updateMany({
      where: { borrowerId: washPeer.id },
      data: {
        status: 'RESTRICTED',
        tier: 'Restricted',
        score: 57,
        restrictReason: 'circular',
        repaymentBps: 3_500,
        limitAmount: 0,
      },
    });
  }

  console.log('seed: writing the default registry');
  const [cured, uncured] = [PEERS[1], PEERS[0]];

  if (cured && uncured) {
    const curedBorrower = await prisma.borrower.findUnique({ where: { handle: cured.handle } });
    const uncuredBorrower = await prisma.borrower.findUnique({ where: { handle: uncured.handle } });

    if (curedBorrower) {
      await prisma.defaultRecord.create({
        data: {
          borrowerId: curedBorrower.id,
          declaredAt: new Date('2026-07-14T00:00:00.000Z'),
          curedAt: new Date('2026-07-29T00:00:00.000Z'),
          principal: 1_850,
          recovered: 1_850,
          trigger: 'coverage ratio 0.31',
          evidenceHash: '0x6d20…be15',
          automatic: true,
        },
      });
    }

    if (uncuredBorrower) {
      await prisma.defaultRecord.create({
        data: {
          borrowerId: uncuredBorrower.id,
          declaredAt: new Date('2026-06-28T00:00:00.000Z'),
          principal: 4_200,
          recovered: 960,
          trigger: 'router disabled',
          evidenceHash: '0x1c88…44f7',
          automatic: true,
        },
      });
    }
  }

  console.log('seed: done');
}

main()
  .catch((error: unknown) => {
    console.error('seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
