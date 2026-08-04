/**
 * What the protocol notices on its own. PRD §22.7.
 *
 * Every check here runs on data the protocol observed and stored itself —
 * settled days, the payer grain behind them, and the exclusions the indexer
 * attached. Nothing is taken from the borrower's word.
 *
 * The decisions are pure so they can be argued with. A borrower whose limit
 * was withdrawn is owed a reason that can be recomputed from the same inputs,
 * and a threshold buried inside a database transaction cannot be.
 */

/** What the window looked like before this batch, and after it. */
export interface DetectionSignals {
  /** Eligible revenue in the 30-day window, after and before. */
  eligible: number;
  priorEligible: number;
  /** Herfindahl on the 0–10,000 scale, after and before. */
  hhi: number;
  priorHhi: number;
  largestPayerPct: number;
  /** Revenue excluded for related-wallet or circular-funding reasons. */
  washAmount: number;
  washPayers: number;
  /** Distinct settled days those excluded payers appear on. */
  washDays: number;
  /** Gross revenue in the window, the denominator for the wash share. */
  gross: number;
}

export type FindingKind = 'circular' | 'revenue_decline' | 'concentration';

export interface Finding {
  kind: FindingKind;
  /** `restrict` withdraws the limit; `watch` freezes new draws only. */
  action: 'restrict' | 'watch';
  /** One sentence, recorded verbatim on the borrower's record. */
  reason: string;
}

/**
 * Share of gross revenue that must be excluded as circular before the
 * protocol treats the borrower as manufacturing revenue rather than as
 * having attracted a few bad payers.
 *
 * A single related wallet is a fact about a customer. A tenth of the book
 * arriving from wallets the borrower funded is a fact about the borrower.
 */
const WASH_SHARE = 0.1;

/** Distinct payers below which circular flow reads as coincidence. */
const WASH_MIN_PAYERS = 2;

/**
 * Decline in eligible revenue that freezes new draws.
 *
 * Set well outside ordinary variation: this book's own daily series moves a
 * few percent, and the underwriter already reprices anything above 10%. A
 * quarter of the base disappearing is a different kind of event — the
 * repayment budget that justified the limit is no longer there.
 */
const DECLINE = 0.25;

/**
 * Concentration jump that freezes new draws.
 *
 * Measured as a *change*, not a level. A borrower who has always been
 * concentrated was underwritten that way; one who became concentrated this
 * week lost customers, and losing customers is the event worth catching.
 */
const HHI_JUMP = 750;

/** Level at which concentration is unacceptable regardless of history. */
const HHI_CEILING = 2_500;

export function detect(signals: DetectionSignals): Finding[] {
  const findings: Finding[] = [];

  const washShare = signals.gross > 0 ? signals.washAmount / signals.gross : 0;
  if (washShare >= WASH_SHARE && signals.washPayers >= WASH_MIN_PAYERS) {
    findings.push({
      kind: 'circular',
      action: 'restrict',
      reason: `${signals.washPayers} related payers contributed ${signals.washAmount.toFixed(2)} USDC across ${signals.washDays} settled days — ${(washShare * 100).toFixed(1)}% of gross revenue, excluded as circular`,
    });
  }

  // Only meaningful against a window that existed. A borrower whose first
  // batch is small has not declined; they have started.
  if (signals.priorEligible > 0) {
    const drop = (signals.priorEligible - signals.eligible) / signals.priorEligible;
    if (drop >= DECLINE) {
      findings.push({
        kind: 'revenue_decline',
        action: 'watch',
        reason: `eligible revenue fell ${(drop * 100).toFixed(1)}% — ${signals.priorEligible.toFixed(2)} to ${signals.eligible.toFixed(2)} USDC`,
      });
    }
  }

  const jumped = signals.priorHhi > 0 && signals.hhi - signals.priorHhi >= HHI_JUMP;
  const overCeiling = signals.hhi >= HHI_CEILING;
  if (jumped || overCeiling) {
    findings.push({
      kind: 'concentration',
      action: 'watch',
      reason: overCeiling
        ? `payer concentration reached ${Math.round(signals.hhi)} HHI, at or past the ${HHI_CEILING} ceiling — largest payer holds ${signals.largestPayerPct.toFixed(1)}%`
        : `payer concentration rose ${Math.round(signals.hhi - signals.priorHhi)} points to ${Math.round(signals.hhi)} HHI — largest payer holds ${signals.largestPayerPct.toFixed(1)}%`,
    });
  }

  return findings;
}

/**
 * The single action to take when several findings fire at once.
 *
 * Restriction outranks a freeze: a borrower manufacturing revenue whose
 * revenue also declined should not end up merely watched because the
 * second finding was evaluated last.
 */
export function severest(findings: Finding[]): Finding | null {
  return findings.find((f) => f.action === 'restrict') ?? findings[0] ?? null;
}
