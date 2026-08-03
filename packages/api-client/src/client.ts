import type {
  ActivityEvent,
  AgentPolicy,
  AmountRequest,
  AnomalyDetail,
  ApiUsage,
  BorrowerRiskDetail,
  ApiErrorBody,
  AssessmentDetail,
  AssessmentHistoryEntry,
  AuthTokens,
  BorrowerProfile,
  CustodyStatus,
  DeclarationStatus,
  DefaultRegistry,
  DrawRequest,
  ExposureReport,
  LimitRecommendation,
  MutationResult,
  NonceResponse,
  NotificationList,
  PartnerConsole,
  ObservationStatus,
  PolicyUpdate,
  ProtocolSnapshot,
  ProtocolStats,
  ReputationCard,
  ReserveStatus,
  RevenueCustomer,
  RevenueDetail,
  RevenueExcluded,
  RiskAlert,
  RiskParameter,
  SandboxProfile,
  SandboxScore,
  SessionUser,
  TierDistribution,
  VaultPerformance,
  VaultPortfolio,
  WatchlistEntry,
} from './contracts';

/**
 * Thrown for any non-2xx response, so callers branch on `code` rather than
 * matching on message text. Network failures surface as `code: 'network'`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'unknown') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** True when signing in again would plausibly help. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }
}

export interface ClientOptions {
  /**
   * Origin the API is served from. Empty means same-origin.
   *
   * Point this at the NestJS API — `http://localhost:4000` locally. The `/v1`
   * version segment is added by the client, so callers never hard-code it.
   */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Bearer token from `POST /auth/verify`. Omitted for public calls. */
  token?: string | null;
  /**
   * Called when the API rejects the token. Lets the app clear its session
   * once, centrally, instead of every caller checking for a 401.
   */
  onUnauthorized?: () => void;
}

const DEFAULT_BASE =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_BASE_URL : undefined) ?? '';

/** All routes live under this. Versioned from the start. */
const PREFIX = '/api/v1';

async function request<T>(path: string, init: RequestInit, options: ClientOptions): Promise<T> {
  const base = options.baseUrl ?? DEFAULT_BASE;
  const doFetch = options.fetch ?? globalThis.fetch;

  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);

  let response: Response;
  try {
    response = await doFetch(`${base}${PREFIX}${path}`, { ...init, headers });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : 'Network request failed',
      0,
      'network',
    );
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;

    // One place decides that the session is gone, rather than every screen.
    if (response.status === 401) options.onUnauthorized?.();

    throw new ApiError(
      body?.error ?? `Request failed with ${response.status}`,
      response.status,
      body?.code ?? 'http_error',
    );
  }

  return (await response.json()) as T;
}

/**
 * Typed access to the Rivora protocol API.
 *
 * Grouped by the surface each call belongs to, matching the API's own tags.
 * `public` needs no token; everything else does, and the role that may reach
 * it is enforced server-side — a client that omits the token gets 401, one
 * with the wrong role gets 403.
 */
export function createApiClient(options: ClientOptions = {}) {
  const get = <T>(path: string) => request<T>(path, { method: 'GET' }, options);

  const send = <T>(method: string, path: string, body?: unknown, extraHeaders?: HeadersInit) =>
    request<T>(
      path,
      {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: extraHeaders,
      },
      options,
    );

  const post = <T>(path: string, body?: unknown, headers?: HeadersInit) =>
    send<T>('POST', path, body, headers);

  /**
   * Money mutations carry an idempotency key.
   *
   * A retry after a dropped connection replays the first response instead of
   * moving money twice. Generated per call rather than per client, so two
   * separate draws are never mistaken for a retry of one.
   */
  const mutate = <T>(path: string, body?: unknown) =>
    post<T>(path, body, { 'idempotency-key': idempotencyKey() });

  return {
    // ── auth ──────────────────────────────────────────────────────────────
    auth: {
      /** Step 1: a single-use challenge to embed in the SIWE message. */
      nonce: (address: string) => post<NonceResponse>('/auth/nonce', { address }),
      /** Step 2: exchange the signed message for a session token. */
      verify: (message: string, signature: string) =>
        post<AuthTokens>('/auth/verify', { message, signature }),
      /** Resolves the role fresh, so a grant takes effect without re-signing. */
      me: () => get<SessionUser>('/auth/me'),
      logout: () => post<void>('/auth/logout'),
    },

    // ── public ────────────────────────────────────────────────────────────
    stats: () => get<ProtocolStats>('/protocol/stats'),
    distribution: () => get<TierDistribution[]>('/distribution'),
    activity: () => get<{ events: ActivityEvent[] }>('/activity'),
    reputation: (handle: string) =>
      get<ReputationCard>(`/reputation/${encodeURIComponent(handle)}`),
    defaults: () => get<DefaultRegistry>('/defaults'),

    // ── authenticated, any role ───────────────────────────────────────────
    snapshot: () => get<ProtocolSnapshot>('/snapshot'),

    // ── borrower ──────────────────────────────────────────────────────────
    borrower: {
      profile: () => get<BorrowerProfile>('/profile'),
      observation: () => get<ObservationStatus>('/observation'),
      revenue: () => get<RevenueDetail>('/revenue'),
      customers: () => get<RevenueCustomer[]>('/revenue/customers'),
      excluded: () => get<RevenueExcluded>('/revenue/excluded'),
      assessment: () => get<AssessmentDetail>('/credit/assessment'),
      history: () => get<AssessmentHistoryEntry[]>('/credit/history'),
      custody: () => get<CustodyStatus>('/custody'),
      restoreBinding: () => post<CustodyStatus>('/custody/restore-binding'),
      policy: () => get<AgentPolicy>('/policy'),
      updatePolicy: (changes: PolicyUpdate) => send<AgentPolicy>('PATCH', '/policy', changes),
      reserve: () => get<ReserveStatus>('/reserve'),
      notifications: () => get<NotificationList>('/notifications'),
      markRead: (ids?: string[]) => post<{ updated: number }>('/notifications/read', { ids }),
      registerService: (body: Record<string, unknown>) => post<unknown>('/services', body),
      verifyEndpoint: (endpoint: string) =>
        post<unknown>('/services/verify-endpoint', { endpoint }),
    },

    // ── credit ────────────────────────────────────────────────────────────
    credit: {
      draw: (body: DrawRequest) => mutate<MutationResult>('/credit/draw', body),
      repay: (body: AmountRequest) => mutate<MutationResult>('/credit/repay', body),
    },

    // ── vault ─────────────────────────────────────────────────────────────
    vault: {
      portfolio: () => get<VaultPortfolio>('/vault/portfolio'),
      performance: () => get<VaultPerformance>('/vault/performance'),
      deposit: (body: AmountRequest) => mutate<MutationResult>('/vault/deposit', body),
      withdraw: (body: AmountRequest) => mutate<MutationResult>('/vault/withdraw', body),
      claimQueue: () => post<{ snapshot: ProtocolSnapshot }>('/vault/queue/claim'),
      cancelQueue: () => post<{ snapshot: ProtocolSnapshot }>('/vault/queue/cancel'),
    },

    // ── risk operator ─────────────────────────────────────────────────────
    risk: {
      watchlist: () => get<WatchlistEntry[]>('/risk/watchlist'),
      exposure: () => get<ExposureReport>('/risk/exposure'),
      parameters: () => get<RiskParameter[]>('/risk/params'),
      alerts: () => get<RiskAlert[]>('/risk/alerts'),
      recommendations: () => get<LimitRecommendation[]>('/risk/recommendations'),
      borrower: (handle: string) =>
        get<BorrowerRiskDetail>(`/risk/borrower/${encodeURIComponent(handle)}`),
      anomaly: (reference?: string) =>
        get<AnomalyDetail>(reference ? `/risk/anomaly?ref=${encodeURIComponent(reference)}` : '/risk/anomaly'),
      audit: () => get<unknown[]>('/risk/audit'),
      /** First signature of the quorum. Commits nothing by itself. */
      declareDefault: (body: Record<string, unknown>) =>
        post<DeclarationStatus>('/risk/defaults/declare', body),
      /** Second signature. Commits the permanent record at quorum. */
      approveDefault: (id: string) =>
        post<DeclarationStatus>(`/risk/defaults/${encodeURIComponent(id)}/approve`),
      pendingDefaults: () => get<DeclarationStatus[]>('/risk/defaults/pending'),
    },

    // ── partner ───────────────────────────────────────────────────────────
    partner: {
      /** The signed-in wallet's own keys and their combined usage. */
      console: (days?: number) =>
        get<PartnerConsole>(days ? `/partner/console?days=${days}` : '/partner/console'),
      /** The presenting key's own usage. For programmatic callers. */
      usage: (days?: number) =>
        get<ApiUsage>(days ? `/partner/usage?days=${days}` : '/partner/usage'),
    },

    // ── partner sandbox ───────────────────────────────────────────────────
    sandbox: {
      profiles: () => get<SandboxProfile[]>('/partner/sandbox/profiles'),
      score: (id: string) => post<SandboxScore>(`/partner/sandbox/score/${encodeURIComponent(id)}`),
    },

    // ── keeper ────────────────────────────────────────────────────────────
    settlement: {
      tick: () => mutate<{ snapshot: ProtocolSnapshot }>('/settlement/tick'),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * A unique key per mutation.
 *
 * `crypto.randomUUID` where available. The fallback is only reached on old
 * runtimes and is still unique enough for the purpose — the key needs to be
 * distinct per call, not unguessable.
 */
function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}
