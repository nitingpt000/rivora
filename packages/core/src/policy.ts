/**
 * The agent spending policy, evaluated. PRD §22.8.
 *
 * Borrowed funds are spent by software. The policy is what bounds that
 * spending, and until now it was stored, displayed, made editable — and
 * consulted by nothing. A limit nobody checks is a claim, not a control.
 *
 * Pure, and in `@rivora/core` rather than in the API, because the draw dialog
 * previews the same decision the server enforces. Two implementations would
 * eventually disagree, and the one the borrower saw would be the wrong one.
 */

export interface SpendingPolicy {
  /** Largest single payment, USDC. */
  maxPayment: number;
  /** Ceiling on the day's total, USDC. */
  maxDaily: number;
  /** Already spent against `maxDaily` today. */
  spentToday: number;
  /** Above this, an agent needs the owner's signature. */
  humanApprovalThreshold: number;
  /** Empty means every category is permitted unless blocked. */
  allowedCategories: string[];
  blockedCategories: string[];
}

export interface SpendRequest {
  amount: number;
  category: string;
  /**
   * True when the owner's own wallet authorised this spend.
   *
   * A draw is made from an owner-authenticated session, so the owner *is*
   * the signature the approval threshold asks for. The threshold exists to
   * bound what the agent does on its own, not to make the owner approve
   * themselves.
   */
  ownerAuthorised: boolean;
}

export type SpendOutcome = 'allowed' | 'rejected' | 'queued';

export interface SpendDecision {
  outcome: SpendOutcome;
  /** Machine-readable, for the API's error code. Empty when allowed. */
  code: '' | 'exceeds_max_payment' | 'exceeds_daily_cap' | 'category_blocked' | 'needs_approval';
  /** One sentence, recorded on the decision and shown to the caller. */
  reason: string;
}

const ALLOWED: SpendDecision = { outcome: 'allowed', code: '', reason: '' };

export function evaluateSpend(request: SpendRequest, policy: SpendingPolicy): SpendDecision {
  const amount = Number.isFinite(request.amount) ? request.amount : 0;

  if (amount > policy.maxPayment) {
    return {
      outcome: 'rejected',
      code: 'exceeds_max_payment',
      reason: `${amount.toFixed(2)} USDC is above the ${policy.maxPayment.toFixed(2)} single-payment limit`,
    };
  }

  if (policy.spentToday + amount > policy.maxDaily) {
    const left = Math.max(0, policy.maxDaily - policy.spentToday);
    return {
      outcome: 'rejected',
      code: 'exceeds_daily_cap',
      reason: `${amount.toFixed(2)} USDC would pass the ${policy.maxDaily.toFixed(2)} daily cap — ${left.toFixed(2)} remains today`,
    };
  }

  const category = request.category.trim();

  if (policy.blockedCategories.some((blocked) => matches(blocked, category))) {
    return {
      outcome: 'rejected',
      code: 'category_blocked',
      reason: `"${category}" is a blocked category`,
    };
  }

  // An empty allow-list permits everything not explicitly blocked. Treating
  // it as "nothing is allowed" would lock out every borrower who never
  // configured one.
  if (
    policy.allowedCategories.length > 0 &&
    !policy.allowedCategories.some((allowed) => matches(allowed, category))
  ) {
    return {
      outcome: 'rejected',
      code: 'category_blocked',
      reason: `"${category}" is not in the permitted categories (${policy.allowedCategories.join(', ')})`,
    };
  }

  if (!request.ownerAuthorised && amount > policy.humanApprovalThreshold) {
    return {
      outcome: 'queued',
      code: 'needs_approval',
      reason: `${amount.toFixed(2)} USDC is above the ${policy.humanApprovalThreshold.toFixed(2)} approval threshold and needs an owner signature`,
    };
  }

  return ALLOWED;
}

/** Categories are compared case-insensitively — "Compute" and "compute" are one. */
function matches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
