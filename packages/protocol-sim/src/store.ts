'use client';

import { ApiError, createApiClient } from '@rivora/api-client';
import type {
  ActivityEvent,
  AgentPolicy,
  AlertItem,
  AllowlistEntry,
  AnomalyDetail,
  AnomalyEvidence,
  AnomalyWallet,
  AssessmentDetail,
  AssessmentHistoryEntry,
  BorrowerProfile,
  Constraint,
  CustodyStatus,
  DefaultRecordEntry,
  DefaultRegistry,
  ExposureBucket,
  ExposureReport,
  LimitRecommendation,
  FactorPenaltyEntry,
  MutationResult,
  NotificationList,
  ObservationRequirement,
  ObservationStatus,
  PolicyDecision,
  ProtocolSnapshot,
  ProtocolStats,
  ReputationBand,
  ReputationCard,
  ReserveEvent,
  ReserveStatus,
  RevenueCustomer,
  RevenueDetail,
  RevenueExcluded,
  RiskAlert,
  RiskParameter,
  Role,
  SandboxProfile,
  SandboxScore,
  ScoreComponent,
  SectorExposure,
  SessionUser,
  UpstreamDependency,
  UpstreamExposure,
  VaultPerformance,
  VaultPortfolio,
  WatchlistEntry,
} from '@rivora/api-client';
import { create } from 'zustand';

import { derive } from './derive';
import type { Derived } from './derive';
import { clearSession, loadSession, saveSession, type AuthStatus } from './session';
import { applySnapshot, initialState } from './state';
import type { ModalKind, OnboardingState, Receipt, SimState } from './state';

/** Landing route per role, so the client can route after sign-in. */
const HOME: Record<Role, string> = {
  borrower: '/dashboard',
  lp: '/vault',
  ops: '/risk',
  partner: '/partner',
};

export interface SimActions {
  // ── auth ────────────────────────────────────────────────────────────────
  /**
   * Full Sign-In With Ethereum handshake.
   *
   * Nonce, build the message, ask the wallet to sign, exchange for a token.
   * Returns the landing route, or null when the wallet has no role yet.
   */
  signIn: (
    address: string,
    signMessage: (message: string) => Promise<string>,
    buildMessage: (params: { address: string; nonce: string }) => string,
  ) => Promise<string | null>;
  signOut: () => void;
  /** Restores a session from storage on first mount. */
  restoreSession: () => void;

  // ── data ────────────────────────────────────────────────────────────────
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  loadPublic: () => Promise<void>;
  loadBorrower: () => Promise<void>;
  loadSandbox: () => Promise<void>;
  /** Loads one borrower for the operator's detail screen. */
  loadRiskBorrower: (handle: string) => Promise<void>;
  /** Loads a public reputation card. Needs no session. */
  loadReputation: (handle: string) => Promise<void>;
  loadVault: () => Promise<void>;
  loadRisk: () => Promise<void>;

  // ── ui ──────────────────────────────────────────────────────────────────
  setDraft: <K extends DraftKey>(key: K, value: SimState[K]) => void;
  openModal: (modal: Exclude<ModalKind, null>) => void;
  closeModal: () => void;
  dismissReceipt: () => void;

  // ── money ───────────────────────────────────────────────────────────────
  draw: () => Promise<void>;
  repay: () => Promise<void>;
  deposit: () => Promise<void>;
  withdraw: () => Promise<void>;
  claimQueue: () => Promise<void>;
  cancelQueue: () => Promise<void>;
  restoreBinding: () => Promise<void>;

  // ── onboarding ──────────────────────────────────────────────────────────
  setOnboarding: <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => void;
  onboardingNext: () => void;
  onboardingBack: () => void;
  toggleTerm: (index: number) => void;
  verifyEndpoint: () => Promise<void>;
  deployRouter: () => void;
  completeOnboarding: () => Promise<void>;

  selectSandbox: (id: string) => void;
  sendSandbox: () => Promise<void>;
}

type DraftKey =
  | 'drawAmount'
  | 'drawCategory'
  | 'repayAmount'
  | 'depositAmount'
  | 'withdrawAmount';

export type SimStore = SimState & SimActions;

function message(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return 'Something went wrong.';
}

export const useProtocol = create<SimStore>()((set, get) => {
  /**
   * A client carrying the current token.
   *
   * Rebuilt per call rather than memoised so it always reflects the live
   * session — a stale client holding an expired token would keep 401ing after
   * the user had signed in again.
   */
  const api = () =>
    createApiClient({
      token: get().token,
      onUnauthorized: () => {
        // The server has rejected the token. Clearing here means one place
        // decides the session is gone, rather than every screen guessing.
        clearSession();
        set({ token: null, user: null, authStatus: 'anonymous', persona: null });
      },
    });

  const commit = async (
    run: () => Promise<MutationResult | { snapshot: ProtocolSnapshot }>,
  ): Promise<void> => {
    set({ pending: true, mutationError: null });
    try {
      const result = await run();
      const receipt = 'receipt' in result ? (result.receipt as Receipt) : null;
      set({
        ...applySnapshot(result.snapshot),
        pending: false,
        sync: 'ready',
        ...(receipt ? { receipt } : {}),
      });
    } catch (cause) {
      set({ pending: false, mutationError: message(cause) });
    }
  };

  return {
    ...initialState(),

    // ── auth ──────────────────────────────────────────────────────────────

    signIn: async (address, signMessage, buildMessage) => {
      set({ authStatus: 'signing', authError: null });

      try {
        const { nonce } = await api().auth.nonce(address);
        const text = buildMessage({ address, nonce });
        const signature = await signMessage(text);

        const tokens = await api().auth.verify(text, signature);
        const expiresAt = Date.now() + tokens.expiresIn * 1_000;

        saveSession({ token: tokens.accessToken, expiresAt, user: tokens.user });

        set({
          token: tokens.accessToken,
          tokenExpiresAt: expiresAt,
          user: tokens.user,
          authStatus: 'authenticated',
          authError: null,
          persona: tokens.user.role,
        });

        return tokens.user.role ? HOME[tokens.user.role] : null;
      } catch (cause) {
        // A declined wallet prompt is a cancellation, not a failure worth
        // shouting about — it reads as an error only if we say so.
        const declined =
          cause instanceof Error && /reject|denied|cancel/i.test(cause.message);

        set({
          authStatus: declined ? 'anonymous' : 'error',
          authError: declined ? null : message(cause),
        });
        return null;
      }
    },

    signOut: () => {
      clearSession();
      set({
        token: null,
        tokenExpiresAt: null,
        user: null,
        authStatus: 'anonymous',
        authError: null,
        persona: null,
      });
    },

    restoreSession: () => {
      const stored = loadSession();
      if (!stored) return;

      set({
        token: stored.token,
        tokenExpiresAt: stored.expiresAt,
        user: stored.user,
        authStatus: 'authenticated',
        persona: stored.user.role,
      });
    },

    // ── data ──────────────────────────────────────────────────────────────

    /** Public protocol figures. Needs no session. */
    loadPublic: async () => {
      try {
        const [stats, defaults] = await Promise.all([api().stats(), api().defaults()]);
        set({ stats, defaults, sync: 'ready', syncError: null });
      } catch (cause) {
        set({ sync: 'error', syncError: message(cause) });
      }
    },

    load: async () => {
      if (get().sync === 'loading') return;
      set({ sync: 'loading', syncError: null });

      try {
        // Public figures always; the full snapshot only with a session.
        const [stats, defaults, distribution] = await Promise.all([
          api().stats(),
          api().defaults(),
          api().distribution(),
        ]);
        set({ stats, defaults, distribution });

        if (!get().token) {
          set({ sync: 'ready', syncError: null });
          return;
        }

        const snapshot = await api().snapshot();
        set({ ...applySnapshot(snapshot), sync: 'ready', syncError: null });
      } catch (cause) {
        set({ sync: 'error', syncError: message(cause) });
      }
    },

    refresh: async () => {
      try {
        const stats = await api().stats();
        set({ stats });

        if (!get().token) return;

        const snapshot = await api().snapshot();
        set({ ...applySnapshot(snapshot), sync: 'ready', syncError: null });

        // The surface endpoints too — a dashboard that refreshes its position
        // but not its revenue would show two moments in time side by side.
        const role = get().user?.role;
        if (role === 'borrower') await get().loadBorrower();
        else if (role === 'lp') await get().loadVault();
        else if (role === 'ops') await get().loadRisk();
      } catch {
        // A failed background refresh leaves the last good data on screen.
        // Surfacing it would flash an error over figures still perfectly valid.
      }
    },

    loadBorrower: async () => {
      if (get().user?.role !== 'borrower') return;

      try {
        const client = api().borrower;
        const [
          profile,
          observation,
          revenue,
          customers,
          excluded,
          assessment,
          history,
          custody,
          policy,
          reserve,
          notifications,
        ] = await Promise.all([
            client.profile(),
            client.observation(),
            client.revenue(),
            client.customers(),
            client.excluded(),
            client.assessment(),
            client.history(),
            client.custody(),
            client.policy(),
            client.reserve(),
            client.notifications(),
          ]);

        set({
          profile,
          observation,
          // A service still inside the observation window sees the checklist
          // screen; one that has cleared it sees the position.
          serviceView: observation.eligible ? 'seeded' : 'new',
          revenue,
          customers,
          excluded,
          assessment,
          history,
          custody,
          policy,
          reserveStatus: reserve,
          notificationList: notifications,
        });
      } catch (cause) {
        set({ syncError: message(cause) });
      }
    },

    loadVault: async () => {
      if (get().user?.role !== 'lp') return;

      try {
        const [portfolio, performance] = await Promise.all([
          api().vault.portfolio(),
          api().vault.performance(),
        ]);
        set({ portfolio, performance });
      } catch (cause) {
        set({ syncError: message(cause) });
      }
    },

    loadRisk: async () => {
      if (get().user?.role !== 'ops') return;

      try {
        const risk = api().risk;
        const [watchlist, exposure, riskParams, riskAlerts, recommendations] = await Promise.all([
          risk.watchlist(),
          risk.exposure(),
          risk.parameters(),
          risk.alerts(),
          risk.recommendations(),
        ]);

        // Absent unless something was detected. A 404 here is the normal case,
        // so it must not fail the whole surface.
        const anomaly = await risk.anomaly().catch(() => null);

        set({ watchlist, exposure, riskParams, riskAlerts, recommendations, anomaly });
      } catch (cause) {
        set({ syncError: message(cause) });
      }
    },

    // ── ui ────────────────────────────────────────────────────────────────

    setDraft: (key, value) => set({ [key]: value } as Partial<SimState>),
    openModal: (modal) => set({ modal, receipt: null, mutationError: null }),
    closeModal: () => set({ modal: null, receipt: null, mutationError: null }),
    dismissReceipt: () => set({ modal: null, receipt: null, mutationError: null }),

    // ── money ─────────────────────────────────────────────────────────────

    draw: async () => {
      const s = get();
      await commit(() =>
        api().credit.draw({ amount: parseFloat(s.drawAmount) || 0, category: s.drawCategory }),
      );
    },

    repay: async () => {
      const s = get();
      const owed = s.principal + s.accruedInterest;
      await commit(() =>
        api().credit.repay({ amount: Math.min(parseFloat(s.repayAmount) || 0, owed) }),
      );
    },

    deposit: async () => {
      await commit(() => api().vault.deposit({ amount: parseFloat(get().depositAmount) || 0 }));
    },

    withdraw: async () => {
      await commit(() => api().vault.withdraw({ amount: parseFloat(get().withdrawAmount) || 0 }));
    },

    claimQueue: async () => {
      await commit(() => api().vault.claimQueue());
      await get().loadVault();
    },

    cancelQueue: async () => {
      await commit(() => api().vault.cancelQueue());
      await get().loadVault();
    },

    restoreBinding: async () => {
      set({ pending: true, mutationError: null });
      try {
        const custody = await api().borrower.restoreBinding();
        set({ custody, pending: false });
        await get().load();
      } catch (cause) {
        set({ pending: false, mutationError: message(cause) });
      }
    },

    // ── onboarding ────────────────────────────────────────────────────────

    setOnboarding: (key, value) => set((s) => ({ onboarding: { ...s.onboarding, [key]: value } })),

    onboardingNext: () =>
      set((s) => ({
        onboarding: { ...s.onboarding, step: Math.min(4, s.onboarding.step + 1) as 1 | 2 | 3 | 4 },
      })),

    onboardingBack: () =>
      set((s) => ({
        onboarding: { ...s.onboarding, step: Math.max(1, s.onboarding.step - 1) as 1 | 2 | 3 | 4 },
      })),

    toggleTerm: (index) =>
      set((s) => {
        const terms = [...s.onboarding.terms] as OnboardingState['terms'];
        terms[index] = !terms[index];
        return { onboarding: { ...s.onboarding, terms } };
      }),

    /**
     * Runs the endpoint probe.
     *
     * The staged log is the point of the screen: the borrower watches the
     * protocol resolve the host, read the live 402 challenge and compare the
     * advertised `payTo` against the bound router. The API returns the whole
     * log at once, so it is replayed here at reading speed rather than
     * appearing as a wall of text.
     */
    verifyEndpoint: async () => {
      const { onboarding } = get();
      set((s) => ({ onboarding: { ...s.onboarding, verifying: true, verifyLog: [] } }));

      try {
        const result = (await api().borrower.verifyEndpoint(onboarding.endpoint)) as {
          log: Array<{ text: string; mark: string }>;
        };

        for (const [i, line] of result.log.entries()) {
          await new Promise((r) => setTimeout(r, 320));
          set((s) => ({
            onboarding: {
              ...s.onboarding,
              verifyLog: [...s.onboarding.verifyLog, line],
              verified: i === result.log.length - 1,
              verifying: i !== result.log.length - 1,
            },
          }));
        }
      } catch (cause) {
        set((s) => ({
          onboarding: {
            ...s.onboarding,
            verifying: false,
            verifyLog: [...s.onboarding.verifyLog, { text: message(cause), mark: '✕' }],
          },
        }));
      }
    },

    deployRouter: () => set((s) => ({ onboarding: { ...s.onboarding, deployed: true } })),

    completeOnboarding: async () => {
      const { onboarding } = get();
      set({ pending: true, mutationError: null });

      try {
        await api().borrower.registerService({
          serviceName: onboarding.serviceName,
          category: onboarding.category,
          endpoint: onboarding.endpoint,
          custody: onboarding.custody,
        });

        set((s) => ({
          onboarding: { ...s.onboarding, completed: true },
          persona: 'borrower',
          serviceView: 'new',
          pending: false,
        }));

        await get().load();
      } catch (cause) {
        set({ pending: false, mutationError: message(cause) });
      }
    },

    loadReputation: async (handle) => {
      if (!handle) return;
      set({ reputation: null, reputationError: null });

      try {
        set({ reputation: await api().reputation(handle) });
      } catch (cause) {
        set({ reputationError: message(cause) });
      }
    },

    loadRiskBorrower: async (handle) => {
      if (!handle) return;
      set({ riskBorrower: null });

      try {
        set({ riskBorrower: await api().risk.borrower(handle) });
      } catch (cause) {
        set({ syncError: message(cause) });
      }
    },

    loadSandbox: async () => {
      try {
        const profiles = await api().sandbox.profiles();
        set({
          sandboxProfiles: profiles,
          // Select the first profile so the request pane has something to show
          // before the integrator picks one.
          ...(get().sandboxSelection ? {} : { sandboxSelection: profiles[0]?.id ?? '' }),
        });
      } catch (cause) {
        set({ syncError: message(cause) });
      }
    },

    selectSandbox: (id) => set({ sandboxSelection: id, sandboxSent: false, sandboxResult: null }),

    sendSandbox: async () => {
      const id = get().sandboxSelection;
      if (!id) return;

      set({ pending: true, mutationError: null });
      try {
        const sandboxResult = await api().sandbox.score(id);
        set({ sandboxResult, sandboxSent: true, pending: false });
      } catch (cause) {
        set({ pending: false, mutationError: message(cause) });
      }
    },
  };
});

/**
 * Derived values for the current state.
 *
 * Safe to call in any component: `derive` is memoised by state identity, so
 * every consumer in a render tree shares one computation and the snapshot
 * reference is stable between store updates.
 */
export function useDerived(): Derived {
  return useProtocol(derive);
}

export type { AuthStatus, SessionUser };
export type {
  ActivityEvent,
  AgentPolicy,
  AlertItem,
  AllowlistEntry,
  AnomalyDetail,
  AnomalyEvidence,
  AnomalyWallet,
  AssessmentDetail,
  AssessmentHistoryEntry,
  BorrowerProfile,
  Constraint,
  CustodyStatus,
  DefaultRecordEntry,
  DefaultRegistry,
  ExposureBucket,
  ExposureReport,
  LimitRecommendation,
  FactorPenaltyEntry,
  NotificationList,
  ObservationRequirement,
  ObservationStatus,
  PolicyDecision,
  ProtocolStats,
  ReputationBand,
  ReputationCard,
  ReserveEvent,
  ReserveStatus,
  RevenueCustomer,
  RevenueDetail,
  RevenueExcluded,
  RiskAlert,
  RiskParameter,
  SandboxProfile,
  SandboxScore,
  ScoreComponent,
  SectorExposure,
  UpstreamDependency,
  UpstreamExposure,
  VaultPerformance,
  VaultPortfolio,
  WatchlistEntry,
};
