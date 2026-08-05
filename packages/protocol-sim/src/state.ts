import type { BorrowerStatus, CustodyModel, Tier } from '@rivora/core';
import type {
  ActivityEvent,
  AgentPolicy,
  AlertItem,
  AnomalyDetail,
  BorrowerProfile,
  BorrowerRiskDetail,
  ObservationStatus,
  PartnerConsole,
  RiskAlert,
  SandboxProfile,
  SandboxScore,
  AssessmentDetail,
  AssessmentHistoryEntry,
  CustodyStatus,
  DeclarationStatus,
  DefaultRegistry,
  ExposureReport,
  LimitRecommendation,
  NotificationList,
  ProtocolSnapshot,
  ProtocolStats,
  ReputationCard,
  ReserveStatus,
  RevenueCustomer,
  RevenueDetail,
  RevenueExcluded,
  RiskParameter,
  SessionUser,
  TierDistribution,
  VaultPerformance,
  VaultPortfolio,
  WatchlistEntry,
} from '@rivora/api-client';
import type { Persona } from '@rivora/nav';

import type { AuthStatus } from './session';

export type WatchReason = 'revenue' | 'concentration' | '';
export type RestrictReason = 'circular' | 'binding' | '';
export type ModalKind = 'draw' | 'repay' | 'deposit' | 'withdraw' | null;

/** Where the store stands relative to the server. */
export type SyncState = 'idle' | 'loading' | 'ready' | 'error';

export interface Receipt {
  kind: 'draw' | 'repay' | 'deposit' | 'withdraw';
  amount: number;
  queued?: number;
  shares?: number;
  clearsDebt?: boolean;
  tx: string;
}

export interface OnboardingState {
  step: 1 | 2 | 3 | 4;
  serviceName: string;
  category: string;
  description: string;
  operator: 'agent' | 'named';
  entity: string;
  jurisdiction: string;
  endpoint: string;
  verifying: boolean;
  verifyLog: Array<{ text: string; mark: string }>;
  verified: boolean;
  custody: CustodyModel;
  routerMode: 'new' | 'link';
  deployed: boolean;
  pricePerRequest: string;
  costPerRequest: string;
  /** Where draws are paid. Blank means "use the connecting wallet". */
  operatingWallet: string;
  /** Where settled revenue arrives before the router splits it. */
  revenueWallet: string;
  terms: [boolean, boolean, boolean, boolean];
  completed: boolean;
}

/**
 * View state for the whole product.
 *
 * Deliberately flat. The server's snapshot is nested and domain-shaped; this
 * is what 30 screens actually read, and `applySnapshot` is the single adapter
 * between the two. Keeping the flattening in one place means a contract change
 * lands in one function rather than in every component.
 *
 * Three kinds of field live here and they are not interchangeable:
 *  - protocol fields, owned by the server and overwritten on every sync;
 *  - session fields, owned by the wallet connection;
 *  - UI fields (modals, drafts, onboarding), owned by the client alone.
 */
export interface SimState {
  // session
  persona: Persona | null;
  /** Connected wallet, or null when browsing the public surfaces. */
  address: string | null;

  /** Bearer token from Sign-In With Ethereum. Null when anonymous. */
  token: string | null;
  /** Epoch milliseconds. */
  tokenExpiresAt: number | null;
  user: SessionUser | null;
  authStatus: AuthStatus;
  authError: string | null;

  /**
   * Per-surface data, each loaded from its own endpoint.
   *
   * Null means "not fetched yet", which a screen renders as loading — distinct
   * from an empty array, which means the API answered and there is nothing to
   * show. Collapsing the two would make an empty watchlist look like a hang.
   */
  stats: ProtocolStats | null;
  defaults: DefaultRegistry | null;
  /** A public reputation card, looked up by handle. */
  reputation: ReputationCard | null;
  /** Tier distribution across the scored population. Public. */
  distribution: TierDistribution[] | null;
  reputationError: string | null;

  profile: BorrowerProfile | null;
  observation: ObservationStatus | null;
  revenue: RevenueDetail | null;
  customers: RevenueCustomer[] | null;
  excluded: RevenueExcluded | null;
  assessment: AssessmentDetail | null;
  history: AssessmentHistoryEntry[] | null;
  custody: CustodyStatus | null;
  policy: AgentPolicy | null;
  // Named apart from the flat `reserve` balance and `notifications` array that
  // come from the snapshot — same words, different things.
  reserveStatus: ReserveStatus | null;
  notificationList: NotificationList | null;

  portfolio: VaultPortfolio | null;
  performance: VaultPerformance | null;

  watchlist: WatchlistEntry[] | null;
  exposure: ExposureReport | null;
  riskParams: RiskParameter[] | null;
  riskAlerts: RiskAlert[] | null;
  recommendations: LimitRecommendation[] | null;
  anomaly: AnomalyDetail | null;
  /** A named borrower, loaded on the operator's detail screen. */
  riskBorrower: BorrowerRiskDetail | null;
  /** Declarations still collecting operator signatures. */
  pendingDeclarations: DeclarationStatus[] | null;

  /** The partner's own keys and usage. Loaded on the partner surface. */
  partnerConsole: PartnerConsole | null;

  sandboxProfiles: SandboxProfile[] | null;
  sandboxResult: SandboxScore | null;
  /** `seeded` shows the day-60 borrower; `new` shows the observation screen. */
  serviceView: 'seeded' | 'new';
  modal: ModalKind;
  receipt: Receipt | null;

  // sync
  sync: SyncState;
  /** Last load failure. Cleared on a successful sync. */
  syncError: string | null;
  /** True while a mutation is in flight; gates the confirm buttons. */
  pending: boolean;
  /** Last mutation rejection, shown inside the dialog that caused it. */
  mutationError: string | null;
  /** ISO instant of the snapshot currently displayed. */
  asOf: string | null;

  // borrower credit position
  status: BorrowerStatus;
  tier: Tier;
  score: number;
  previousScore: number;
  limit: number;
  previousLimit: number;
  principal: number;
  accruedInterest: number;
  pendingDraws: number;
  reserve: number;
  reserveTarget: number;
  repaymentBps: number;
  reserveBps: number;
  completedCycles: number;
  historyDays: number;

  // revenue and health
  eligibleRevenue: number;
  grossRevenue: number;
  excludedRevenue: number;
  dailyRevenue: number;
  growthPct: number;
  largestPayerPct: number;
  hhi: number;
  coverageRatio: number;
  uptimePct: number;
  successPct: number;
  refundRatePct: number;
  latencyMs: number;
  uniquePayers: number;
  repeatPayers: number;
  factors: { S: number; C: number; V: number; D: number; M: number; G: number };
  bindingOk: boolean;
  endpointUp: boolean;
  watchReason: WatchReason;
  restrictReason: RestrictReason;
  anomalyDetected: boolean;

  // vault
  vaultAssets: number;
  vaultLiquidity: number;
  protocolReserve: number;
  firstLossTranche: number;
  queueTotal: number;
  realizedLosses: number;
  activeBorrowers: number;
  onWatch: number;
  routedRevenue30d: number;
  principalRepaid: number;
  interestGenerated: number;

  // liquidity provider
  lpWallet: number;
  lpSupplied: number;
  lpShares: number;
  sharePrice: number;
  lpQueued: number;
  lpQueueFunded: number;

  // form drafts
  drawAmount: string;
  drawCategory: string;
  repayAmount: string;
  depositAmount: string;
  withdrawAmount: string;
  sandboxSelection: string;
  sandboxSent: boolean;

  // streams
  events: ActivityEvent[];
  notifications: AlertItem[];

  onboarding: OnboardingState;
}

/**
 * Placeholder protocol values, used only before the first sync lands.
 *
 * Zeroes rather than fixtures: a screen that renders plausible-looking numbers
 * it did not get from the server is worse than one that renders an obvious
 * nothing, because only the second is recognisable as "not loaded yet".
 */
export function initialState(): SimState {
  return {
    persona: null,
    address: null,
    serviceView: 'seeded',
    modal: null,
    receipt: null,

    token: null,
    tokenExpiresAt: null,
    user: null,
    authStatus: 'anonymous',
    authError: null,

    stats: null,
    defaults: null,
    reputation: null,
    distribution: null,
    reputationError: null,
    profile: null,
    observation: null,
    revenue: null,
    customers: null,
    excluded: null,
    assessment: null,
    history: null,
    custody: null,
    policy: null,
    reserveStatus: null,
    notificationList: null,
    portfolio: null,
    performance: null,
    watchlist: null,
    exposure: null,
    riskParams: null,
    riskAlerts: null,
    recommendations: null,
    anomaly: null,
    riskBorrower: null,
    pendingDeclarations: null,
    partnerConsole: null,
    sandboxProfiles: null,
    sandboxResult: null,

    sync: 'idle',
    syncError: null,
    pending: false,
    mutationError: null,
    asOf: null,

    status: 'OBSERVATION',
    tier: 'Standard',
    score: 0,
    previousScore: 0,
    limit: 0,
    previousLimit: 0,
    principal: 0,
    accruedInterest: 0,
    pendingDraws: 0,
    reserve: 0,
    reserveTarget: 0,
    repaymentBps: 2_000,
    reserveBps: 200,
    completedCycles: 0,
    historyDays: 0,

    eligibleRevenue: 0,
    grossRevenue: 0,
    excludedRevenue: 0,
    dailyRevenue: 0,
    growthPct: 0,
    largestPayerPct: 0,
    hhi: 0,
    coverageRatio: 0,
    uptimePct: 0,
    successPct: 0,
    refundRatePct: 0,
    latencyMs: 0,
    uniquePayers: 0,
    repeatPayers: 0,
    factors: { S: 1, C: 1, V: 1, D: 1, M: 1, G: 1 },
    bindingOk: true,
    endpointUp: true,
    watchReason: '',
    restrictReason: '',
    anomalyDetected: false,

    vaultAssets: 0,
    vaultLiquidity: 0,
    protocolReserve: 0,
    firstLossTranche: 0,
    queueTotal: 0,
    realizedLosses: 0,
    activeBorrowers: 0,
    onWatch: 0,
    routedRevenue30d: 0,
    principalRepaid: 0,
    interestGenerated: 0,

    lpWallet: 0,
    lpSupplied: 0,
    lpShares: 0,
    sharePrice: 1,
    lpQueued: 0,
    lpQueueFunded: 0,

    drawAmount: '400',
    drawCategory: 'Model and data API expenses',
    repayAmount: '',
    depositAmount: '5000',
    withdrawAmount: '5000',
    sandboxSelection: '07',
    sandboxSent: false,

    events: [],
    notifications: [],

    // Registration is the operator describing their own service, so every
    // field they own starts empty. Only the structural choices — custody
    // model, router mode — carry a default, and both are the safe one.
    onboarding: {
      step: 1,
      serviceName: '',
      category: '',
      description: '',
      operator: 'named',
      entity: '',
      jurisdiction: '',
      endpoint: '',
      verifying: false,
      verifyLog: [],
      verified: false,
      custody: 'A',
      routerMode: 'new',
      deployed: false,
      pricePerRequest: '',
      costPerRequest: '',
      operatingWallet: '',
      revenueWallet: '',
      terms: [false, false, false, false],
      completed: false,
    },
  };
}

/**
 * Flattens a server snapshot into view state.
 *
 * The one adapter between the wire contract and what the screens read. Returns
 * a partial so callers can spread it over whatever client-owned state they are
 * already holding — nothing here touches modals, drafts or onboarding.
 */
export function applySnapshot(snapshot: ProtocolSnapshot): Partial<SimState> {
  const { borrower, revenue, health, vault, lp, meta } = snapshot;

  return {
    status: borrower.status,
    tier: borrower.tier,
    score: borrower.score,
    previousScore: borrower.previousScore,
    limit: borrower.limit,
    previousLimit: borrower.previousLimit,
    principal: borrower.principal,
    accruedInterest: borrower.accruedInterest,
    pendingDraws: borrower.pendingDraws,
    reserve: borrower.reserve,
    reserveTarget: borrower.reserveTarget,
    repaymentBps: borrower.repaymentBps,
    reserveBps: borrower.reserveBps,
    completedCycles: borrower.completedCycles,
    historyDays: borrower.historyDays,
    watchReason: borrower.watchReason,
    restrictReason: borrower.restrictReason,
    anomalyDetected: borrower.anomalyDetected,

    eligibleRevenue: revenue.eligible,
    grossRevenue: revenue.gross,
    excludedRevenue: revenue.excluded,
    dailyRevenue: revenue.dailyMean,
    growthPct: revenue.growthPct,
    largestPayerPct: revenue.largestPayerPct,
    hhi: revenue.hhi,
    uniquePayers: revenue.uniquePayers,
    repeatPayers: revenue.repeatPayers,

    coverageRatio: health.coverageRatio,
    uptimePct: health.uptimePct,
    successPct: health.successPct,
    refundRatePct: health.refundRatePct,
    latencyMs: health.latencyMs,
    bindingOk: health.bindingOk,
    endpointUp: health.endpointUp,
    factors: { ...health.factors },

    vaultAssets: vault.totalAssets,
    vaultLiquidity: vault.availableLiquidity,
    protocolReserve: vault.protocolReserve,
    firstLossTranche: vault.firstLossTranche,
    queueTotal: vault.queueTotal,
    realizedLosses: vault.realizedLosses,
    activeBorrowers: vault.activeBorrowers,
    onWatch: vault.onWatch,
    routedRevenue30d: vault.routedRevenue30d,
    principalRepaid: vault.principalRepaid,
    interestGenerated: vault.interestGenerated,
    sharePrice: vault.sharePrice,

    lpWallet: lp.walletBalance,
    lpSupplied: lp.supplied,
    lpShares: lp.shares,
    lpQueued: lp.queued,
    lpQueueFunded: lp.queueFunded,

    events: snapshot.events,
    notifications: snapshot.alerts,
    asOf: meta.asOf,
  };
}
