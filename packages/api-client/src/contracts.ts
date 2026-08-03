import type { BorrowerStatus, CustodyModel, Tier, UnderwritingInputs } from '@rivora/core';

/**
 * The wire contract between the web app and whatever is serving protocol state.
 *
 * Nested and named after the domain rather than after the screens that consume
 * it, because this shape has to survive the mock backend being replaced by an
 * indexer and a set of contract reads. The client flattens it into view state
 * once, in one adapter, so a change here lands in a single place.
 *
 * Money is carried as a number of USDC units, not minor units: every figure the
 * product displays is a USDC amount with 2–6 decimal places, and the values
 * involved are far below the precision limit of a double. A real integration
 * against contract reads should convert from `uint256` at this boundary.
 */

export type Role = 'borrower' | 'lp' | 'ops' | 'partner';

export interface SessionResponse {
  address: string | null;
  /** Null when the address is not registered — the client shows a role picker. */
  role: Role | null;
  /** Landing route for the resolved role. */
  home: string | null;
  /** True when the address matched a registered participant. */
  known: boolean;
}

export interface BorrowerPosition {
  id: string;
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
  custody: CustodyModel;
  /** Empty string when the borrower is not on watch or restricted. */
  watchReason: 'revenue' | 'concentration' | '';
  restrictReason: 'circular' | 'binding' | '';
  /** True once a manipulation event has been detected and written back. */
  anomalyDetected: boolean;
}

export interface RevenueMetrics {
  eligible: number;
  gross: number;
  excluded: number;
  dailyMean: number;
  growthPct: number;
  largestPayerPct: number;
  hhi: number;
  uniquePayers: number;
  repeatPayers: number;
}

export interface HealthMetrics {
  coverageRatio: number;
  uptimePct: number;
  successPct: number;
  refundRatePct: number;
  latencyMs: number;
  bindingOk: boolean;
  endpointUp: boolean;
  factors: UnderwritingInputs;
}

export interface VaultState {
  totalAssets: number;
  availableLiquidity: number;
  protocolReserve: number;
  firstLossTranche: number;
  queueTotal: number;
  realizedLosses: number;
  activeBorrowers: number;
  onWatch: number;
  routedRevenue30d: number;
  principalRepaid: number;
  interestGenerated: number;
  sharePrice: number;
}

export interface LpPosition {
  address: string;
  walletBalance: number;
  supplied: number;
  shares: number;
  queued: number;
  queueFunded: number;
}

export interface ActivityEvent {
  time: string;
  type: string;
  who: string;
  amount: string;
  tx: string;
  note?: string;
}

export interface AlertItem {
  time: string;
  icon: string;
  title: string;
  body?: string;
  unread: boolean;
  tx?: string;
  href?: string;
  cta?: string;
}

export interface SnapshotMeta {
  /** Days of observed history behind the book. */
  day: number;
  network: string;
  /** ISO-8601 instant the snapshot was produced. */
  asOf: string;
}

/** Everything the surfaces read. One request, one consistent moment in time. */
export interface ProtocolSnapshot {
  borrower: BorrowerPosition;
  revenue: RevenueMetrics;
  health: HealthMetrics;
  vault: VaultState;
  lp: LpPosition;
  events: ActivityEvent[];
  alerts: AlertItem[];
  meta: SnapshotMeta;
}

/** A completed state change, plus the snapshot it produced. */
export interface MutationResult<R = Receipt> {
  receipt: R;
  snapshot: ProtocolSnapshot;
}

export interface Receipt {
  kind: 'draw' | 'repay' | 'deposit' | 'withdraw';
  amount: number;
  queued?: number;
  shares?: number;
  clearsDebt?: boolean;
  tx: string;
}

export interface AmountRequest {
  amount: number;
}

export interface DrawRequest extends AmountRequest {
  category: string;
}

/** Shape of a non-2xx response body. */
export interface ApiErrorBody {
  error: string;
  /** Machine-readable reason, for branching in the UI. */
  code?: string;
  /** Correlation id. Worth quoting when reporting a failure. */
  requestId?: string;
}

// ── auth ────────────────────────────────────────────────────────────────────

export interface NonceResponse {
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SessionUser {
  address: string;
  role: Role | null;
  home: string | null;
  known: boolean;
  borrowerId?: string;
}

export interface AuthTokens {
  accessToken: string;
  /** Lifetime in seconds. */
  expiresIn: number;
  tokenType: string;
  user: SessionUser;
}

// ── public ──────────────────────────────────────────────────────────────────

/**
 * Aggregate protocol health, readable without a wallet.
 *
 * Deliberately carries no individual position — that is what `/snapshot` is
 * for, and it requires a session.
 */
export interface ProtocolStats {
  totalValueLocked: number;
  outstandingCredit: number;
  /** 0–1. */
  utilization: number;
  activeBorrowers: number;
  onWatch: number;
  routedRevenue30d: number;
  principalRepaid: number;
  realizedLosses: number;
  defaultRatePct: number;
  repaidFromRevenuePct: number;
  day: number;
  network: string;
  asOf: string;

  firstLossTranche: number;
  /** First-loss tranche as a share of vault assets. */
  firstLossCoveragePct: number;
  /** Eligible revenue across every borrower. */
  eligibleRevenue: number;
  /** Paid requests observed across the protocol. */
  authorizationsIssued: number;
  probeSuccessPct: number;
  meanUptimePct: number;
  /** The same figures the LP surface reports, so the two cannot disagree. */
  vault: VaultEconomics;
}

export interface ReputationBand {
  label: string;
  band: string;
}

/** A borrower's public credit record. Bands, never revenue figures. */
export interface ReputationCard {
  handle: string;
  endpointHash: string | null;
  score: number;
  tier: string;
  monthsObserved: number;
  repaymentCycles: number;
  onTimeRatioPct: number;
  principalRepaid: number;
  defaultsRecorded: number;
  custody: string;
  bands: ReputationBand[];
  attestedAt: string;
  model: string;
}

/** How the scored population sits across tiers. Counts only. */
export interface TierDistribution {
  tier: string;
  sharePct: number;
  subjects: number;
}

export interface DefaultRecordEntry {
  borrower: string;
  declaredAt: string;
  curedAt?: string;
  principal: number;
  recovered: number;
  status: string;
  trigger: string;
  evidenceHash: string;
  automatic: boolean;
  daysToCure: number | null;
}

export interface DefaultRegistry {
  records: DefaultRecordEntry[];
  count: number;
  totalPrincipal: number;
  totalRecovered: number;
  recoveryRatePct: number;
  cureRatePct: number;
}

// ── borrower ────────────────────────────────────────────────────────────────

export interface RevenueDetail {
  eligible: number;
  gross: number;
  excluded: number;
  dailyMean: number;
  growthPct: number;
  largestPayerPct: number;
  hhi: number;
  concentrationBand: string;
  uniquePayers: number;
  repeatPayers: number;
  repeatRatePct: number;
  windowStart?: string;
  windowEnd?: string;
  /** Daily settled revenue over the window, for the chart. */
  dailySeries: number[];
  /** Paid requests authorized over the window. */
  requests: number;
  settled: number;
  failed: number;
  refunded: number;
  /** Mean price per settled request, USDC. */
  meanPrice: number;
  /** Payers first seen inside the window. */
  newPayers: number;
  medianPayerLifetimeDays: number;
}

/** Pseudonymous. Payer addresses are never returned. */
export interface RevenueCustomer {
  label: string;
  revenue30d: number;
  sharePct: number;
  requests30d: number;
  firstSeenAt: string;
}

export interface RevenueExcluded {
  payers: RevenueCustomer[];
  total: number;
  byReason: Record<string, number>;
}

export interface Constraint {
  key: string;
  label: string;
  formula: string;
  value: number;
  binding: boolean;
  nearBinding?: boolean;
  advisory?: boolean;
}

export interface FactorPenaltyEntry {
  symbol: string;
  label: string;
  value: number;
  weight: number;
  points: number;
}

/** One weighted input to the score, as shown on the assessment screen. */
export interface ScoreComponent {
  key: string;
  label: string;
  /** Share of the total score this signal can carry, 0–1. */
  weight: number;
  /** Normalised signal strength, 0–1. */
  value: number;
  /** Points contributed to the 0–100 score. */
  contribution: number;
}

/** Registration details: what the operator entered and what the protocol bound. */
export interface BorrowerProfile {
  handle: string;
  serviceName: string;
  category: string;
  endpoint: string;
  endpointHash?: string;
  routerAddress?: string;
  custody: string;
  operatingWallet: string;
  ownerWallet: string;
  operator?: string;
  jurisdiction?: string;
  kybVerifiedAt?: string;
  registeredAt: string;
}

export interface ObservationRequirement {
  label: string;
  /** Progress toward the threshold, 0–1. */
  ratio: number;
  /** Progress in the requirement's own units, e.g. `21 / 30`. */
  progress: string;
  status: 'pass' | 'pending';
}

export interface ObservationStatus {
  daysObserved: number;
  daysRequired: number;
  requirements: ObservationRequirement[];
  /** True once every requirement passes. */
  eligible: boolean;
  dailySeries: number[];
}

export interface AssessmentDetail {
  score: number;
  tier: string;
  limit: number;
  previousLimit: number;
  bindingKey: string;
  ladder: Constraint[];
  penalties: FactorPenaltyEntry[];
  components: ScoreComponent[];
  quality: number;
  model: string;
  assessedAt: string;
}

export interface AssessmentHistoryEntry {
  at: string;
  score: number;
  tier: string;
  limit: number;
  previousLimit: number;
  bindingKey: string;
}

export interface UpstreamDependency {
  name: string;
  category: string;
  /** Share of the borrower's declared cost base. */
  declaredCostPct: number;
  /** Share of protocol principal exposed through it. */
  sharePct: number;
  substitutable: boolean;
}

export interface CustodyStatus {
  model: string;
  bindingOk: boolean;
  endpointUp: boolean;
  routerAddress: string | null;
  endpointHash: string | null;
  coverageRatio: number;
  coverageState: string;
  uptimePct: number;
  repaymentSharePct: number;
  reserveSharePct: number;
  operatingSharePct: number;
  upstream: UpstreamDependency[];
}

export interface AllowlistEntry {
  address: string;
  name: string;
  category: string;
  lastUsedAt?: string;
}

export interface PolicyDecision {
  at: string;
  recipient: string;
  amount: number;
  category: string;
  outcome: 'allowed' | 'rejected' | 'queued';
  reason: string;
}

export interface AgentPolicy {
  maxPayment: number;
  maxDaily: number;
  spentToday: number;
  humanApprovalThreshold: number;
  allowedCategories: string[];
  blockedCategories: string[];
  policyChangeDelayHours: number;
  pendingChangeAt?: string;
  /** Registered destinations a draw may be spent to. Anything else is refused. */
  allowlist: AllowlistEntry[];
  /** Recent policy evaluations, newest first. */
  decisions: PolicyDecision[];
}

export interface PolicyUpdate {
  maxPayment?: number;
  maxDaily?: number;
  humanApprovalThreshold?: number;
  allowedCategories?: string[];
  blockedCategories?: string[];
}

export interface ReserveEvent {
  at: string;
  type: string;
  /** Signed. Negative when the reserve is drawn down. */
  amount: number;
  /** Reserve balance after the event. */
  balance: number;
  tx?: string;
  note?: string;
}

export interface ReserveStatus {
  balance: number;
  target: number;
  coveragePct: number;
  contributionSharePct: number;
  dailyContribution: number;
  activity: ReserveEvent[];
}

export interface NotificationEntry {
  id: string;
  at: string;
  icon: string;
  title: string;
  body?: string;
  unread: boolean;
  tx?: string;
  href?: string;
  cta?: string;
}

export interface NotificationList {
  notifications: NotificationEntry[];
  unread: number;
  total: number;
}

// ── liquidity provider ──────────────────────────────────────────────────────

export interface VaultPortfolio {
  address: string;
  shares: number;
  sharePrice: number;
  value: number;
  supplied: number;
  earned: number;
  walletBalance: number;
  queued: number;
  queueFunded: number;
  shareOfVaultPct: number;
}

/**
 * Vault yield, cost and concentration.
 *
 * `VaultEconomics` is the part a stranger may read; `VaultPerformance` adds
 * the book's composition, which is for depositors.
 */
export interface VaultEconomics {
  displayedApyPct: number;
  organicApyPct: number;
  subsidyApyPct: number;
  subsidyEnds: string;
  blendedBorrowerRatePct: number;
  protocolSpreadPct: number;
  interestGenerated: number;
  realizedLosses: number;
  coverageMultiple: number;
  weightedMeanPaybackDays: number;
  /** Protocol's cut of interest to date, USDC. */
  protocolSpreadTaken: number;
  subsidyPaidIn: number;
  /** Interest plus subsidy, less the spread. */
  netToLps: number;
  principalOriginated: number;
}

export interface CustodyExposure {
  model: string;
  principal: number;
  sharePct: number;
}

export interface VaultPerformance extends VaultEconomics {
  /** How much of the book repayment is structural for. */
  byCustody: CustodyExposure[];
  bySector: SectorExposure[];
  /** Measured across borrowers — one shared provider is one risk, not many. */
  upstream: UpstreamExposure[];
}

// ── risk operator ───────────────────────────────────────────────────────────

export interface WatchlistEntry {
  handle: string;
  status: string;
  score: number;
  scoreDelta: number;
  tier: string;
  principal: number;
  coverageRatio: number;
  trigger: string;
}

export interface ExposureBucket {
  tier: string;
  borrowers: number;
  principal: number;
  sharePct: number;
}

export interface SectorExposure {
  sector: string;
  principal: number;
  sharePct: number;
  /** Share above which new draws in the sector are blocked. */
  capPct: number;
  breached: boolean;
}

export interface UpstreamExposure {
  name: string;
  category: string;
  /** Principal exposed through this dependency, USDC. */
  principal: number;
  sharePct: number;
  substitutable: boolean;
}

export interface ExposureReport {
  outstandingPrincipal: number;
  vaultAssets: number;
  utilization: number;
  byTier: ExposureBucket[];
  bySector: SectorExposure[];
  /** Measured across borrowers: two services reselling one provider are one risk. */
  upstream: UpstreamExposure[];
  largestExposure: number;
  largestExposurePct: number;
  perBorrowerCapPct: number;
  sectorCapPct: number;
  breaches: number;
}

/** A limit the underwriter would set today, against the one in force. */
export interface LimitRecommendation {
  handle: string;
  current: number;
  recommended: number;
  bindingKey: string;
  tier: string;
  direction: 'raise' | 'reduce' | 'hold';
}

export interface RiskTimelineEntry {
  at: string;
  text: string;
  tx?: string;
}

/** One borrower, as a risk operator sees them: exact factors, not bands. */
export interface BorrowerRiskDetail {
  handle: string;
  serviceName: string;
  operator?: string;
  jurisdiction?: string;
  kybVerifiedAt?: string;
  custody: string;
  status: string;
  tier: string;
  score: number;
  /** Change since the previous assessment. */
  scoreDelta: number;
  principal: number;
  accruedInterest: number;
  limit: number;
  reserve: number;
  repaymentSharePct: number;
  ratePct: number;
  coverageRatio: number;
  hhi: number;
  factors: { S: number; C: number; V: number; D: number; M: number; G: number };
  components: ScoreComponent[];
  /** Assessments, detections and money movement merged, newest first. */
  timeline: RiskTimelineEntry[];
}

export interface RiskAlert {
  severity: 'restrict' | 'warn' | 'info';
  /** Borrower handle, or `Sector`. */
  who: string;
  text: string;
  meta: string;
  /** When the condition was observed. Absent for standing conditions. */
  at?: string;
  href: string;
  cta: string;
}

export interface AnomalyEvidence {
  finding: string;
  at: string;
  detail: string;
  tx?: string;
}

export interface AnomalyWallet {
  address: string;
  fundedOn: string;
  amount: number;
}

/** A detected revenue-manipulation event and the evidence behind it. */
export interface AnomalyDetail {
  reference: string;
  borrower: string;
  kind: string;
  detectedAt: string;
  /** Revenue removed from the eligible base. */
  washAmount: number;
  payerCount: number;
  daysSpanned: number;
  /** Negative proves the activity was not economic. */
  netEconomicRevenue: number;
  evidenceHash: string;
  txHash: string;
  evidence: AnomalyEvidence[];
  fundedWallets: AnomalyWallet[];
  after: {
    eligibleRevenue: number;
    score: number;
    tier: string;
    limit: number;
    repaymentBps: number;
  };
}

// ── partner ─────────────────────────────────────────────────────────────────

export interface UsageDay {
  /** Date, UTC. */
  date: string;
  requests: number;
  billable: number;
}

/**
 * What a partner key has been used for, over a window.
 *
 * Scoped to the presenting key — there is no parameter that could point it at
 * another caller.
 */
export interface ApiUsage {
  from: string;
  to: string;
  /** Every request the key made, including failures. */
  requests: number;
  /** Successful calls on metered routes. Sandbox calls and errors never bill. */
  billable: number;
  /** Distinct borrowers successfully scored. */
  uniqueSubjects: number;
  errorRatePct: number;
  medianLatencyMs: number;
  lastUsedAt?: string;
  byDay: UsageDay[];
}

/** A key the caller owns. Never the key itself — only its non-secret prefix. */
export interface ApiKeySummary {
  label: string;
  /** Leading characters, for recognition. */
  prefix: string;
  scopes: string[];
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

/** What the partner console reads: the caller's keys and their combined usage. */
export interface PartnerConsole {
  keys: ApiKeySummary[];
  usage: ApiUsage;
}

// ── partner sandbox ─────────────────────────────────────────────────────────

export interface SandboxProfile {
  id: string;
  description: string;
  endpoint: string;
}

/** Shaped like the real attestation, but unsigned and marked `sandbox`. */
export interface SandboxScore {
  score: number;
  tier: string;
  recommendedLimit: number;
  bindingKey: string;
  maxAdvanceRate: number;
  maxHorizonDays: number;
  reliabilityBand: string;
  concentrationBand: string;
  custodyModel: string;
  confidence: number;
  components: ScoreComponent[];
  modelVersion: string;
  sandbox: boolean;
}

export interface RiskParameter {
  key: string;
  label: string;
  value: string;
  description: string;
  reference: string;
}
