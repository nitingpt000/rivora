/** Borrower lifecycle states. PRD §17 credit-state machine. */
export type BorrowerStatus =
  | 'OBSERVATION'
  | 'ELIGIBLE'
  | 'ACTIVE'
  | 'WATCH'
  | 'RESTRICTED'
  | 'DELINQUENT'
  | 'DEFAULTED'
  | 'REPAID';

/** Score bands. PRD §14.2. */
export type Tier = 'Prime' | 'Strong' | 'Standard' | 'Restricted' | 'Ineligible';

/**
 * How revenue reaches the protocol. PRD §11.2.
 *
 * This is an underwriting input, not an implementation detail: it bounds the
 * maximum advance rate, because it determines whether repayment is structural
 * (A), policy-enforced (B) or merely behavioural (C).
 */
export type CustodyModel = 'A' | 'B' | 'C';

/** The five sub-unit factors that compose the quality haircut. PRD §13.3. */
export interface QualityFactors {
  /** Service reliability, protocol-observed only. PRD §13.5. */
  S: number;
  /** Customer concentration, `1 − HHI`. PRD §13.7. */
  C: number;
  /** Revenue volatility, from the coefficient of variation. PRD §13.8. */
  V: number;
  /** Revenue diversity, from unique and repeat payers. PRD §13.6. */
  D: number;
  /** Operating capacity, bounded by category cost bands. PRD §13.10. */
  M: number;
}

/** Growth is applied separately because, unlike the others, it may exceed 1. */
export interface UnderwritingInputs extends QualityFactors {
  /** Revenue-growth multiplier. PRD §13.9. */
  G: number;
}

/** One rung of the constraint ladder shown on the Credit screen. PRD §13.3. */
export interface Constraint {
  key: ConstraintKey;
  label: string;
  /** The arithmetic, rendered for the borrower. Empty when there is none. */
  formula: string;
  value: number;
  /** True when this is the rung that determined the approved limit. */
  binding: boolean;
  /**
   * True when the rung does not bind today but would under a modest change in
   * conditions — surfaced with a ⚠ so the borrower is not surprised later.
   */
  nearBinding?: boolean;
  /**
   * True for rungs that are shown for context but do not constrain the
   * approved limit. See `calculateLimit` for why the exposure cap is one.
   */
  advisory?: boolean;
}

export type ConstraintKey =
  | 'quality'
  | 'horizon'
  | 'stressedHorizon'
  | 'custody'
  | 'tierCap'
  | 'newBorrower'
  | 'exposure'
  | 'growthCap';

/** The full result of an assessment, including why the limit is what it is. */
export interface LimitDecision {
  /** The approved limit — the minimum of every constraint. */
  limit: number;
  /** Composite quality factor, `Q`. */
  quality: number;
  /** Every candidate limit, in display order, with the binding one flagged. */
  ladder: Constraint[];
  /** The rung that bound. */
  bindingKey: ConstraintKey;
  /** Per-factor contribution to the quality haircut, in percentage points. */
  penalties: FactorPenalty[];
}

export interface FactorPenalty {
  symbol: keyof QualityFactors;
  label: string;
  value: number;
  weight: number;
  /** Contribution to the haircut, in percentage points. */
  points: number;
}

/** Inputs to a limit calculation. */
export interface LimitParams {
  /** Normalized eligible trailing 30-day revenue. PRD §13.2. */
  normalizedRevenue30d: number;
  tier: Tier;
  factors: UnderwritingInputs;
  custody: CustodyModel;
  /** Basis points of settled revenue routed to repayment. */
  repaymentBps: number;
  /** Limit approved at the previous assessment; gates the growth cap. */
  previousLimit: number;
  /** Total vault assets, for the per-borrower exposure cap. */
  vaultAssets: number;
  /** Days since the borrower's first eligible revenue. */
  historyDays: number;
  /**
   * Repayment cycles the borrower has taken to zero.
   *
   * Lifts the new-borrower cap: the cap exists to bound exposure to a borrower
   * whose repayment loop is unproven, and a completed cycle is the proof.
   */
  completedCycles?: number;
}

/** A single revenue batch split by the router. PRD §12.2. */
export interface WaterfallSplit {
  gross: number;
  toRepayment: number;
  toReserve: number;
  toOperating: number;
}

/** How a repayment was applied. PRD §12.2 / §22.5. */
export interface RepaymentApplication {
  amount: number;
  toInterest: number;
  toPrincipal: number;
  /** Returned to the borrower when the payment exceeds the debt. */
  excess: number;
  /** True when the loan is fully cleared by this payment. */
  clearsDebt: boolean;
}

/** How a withdrawal request is served. PRD §23.4. */
export interface WithdrawalPlan {
  requested: number;
  /** Served from liquidity above the buffer floor. */
  immediate: number;
  /** Enters the FIFO queue, funded by incoming repayments. */
  queued: number;
  /** Utilization-linked exit fee. PRD §23.5. */
  fee: number;
  bufferFloor: number;
  availableNow: number;
}

/** Result of the pre-draw capacity checks. PRD §15.5 / §22.4. */
export interface DrawCheck {
  key: string;
  label: string;
  detail: string;
  value: string;
  pass: boolean;
  /**
   * `blocking` checks gate the draw. `advisory` checks are surfaced but do not
   * refuse it — a breached per-borrower exposure cap freezes the limit at the
   * next assessment rather than blocking today's draw (screens.md S-54).
   */
  severity: 'blocking' | 'advisory';
}

/** Observable inputs behind the 0–100 risk score. PRD §14.3. */
export interface ScoreSignals {
  uptimePct: number;
  successPct: number;
  /** Coefficient of variation of the daily revenue series. */
  revenueCv: number;
  onTimeRatioPct: number;
  completedCycles: number;
  largestPayerPct: number;
  hhi: number;
  uniquePayers: number;
  custody: CustodyModel;
  historyDays: number;
  /** 30-day revenue growth, in percent. Negative for decline. */
  growthPct: number;
  /** Reserve balance as a percentage of its target. */
  reserveCoveragePct: number;
}

/** One weighted signal and what it contributed to the score. */
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
