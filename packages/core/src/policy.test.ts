import { describe, expect, it } from 'vitest';

import { evaluateSpend, type SpendingPolicy } from './policy';

function policy(overrides: Partial<SpendingPolicy> = {}): SpendingPolicy {
  return {
    maxPayment: 100,
    maxDaily: 500,
    spentToday: 0,
    humanApprovalThreshold: 250,
    allowedCategories: [],
    blockedCategories: [],
    ...overrides,
  };
}

const spend = (amount: number, category = 'compute', ownerAuthorised = true) => ({
  amount,
  category,
  ownerAuthorised,
});

describe('within the policy', () => {
  it('allows an ordinary payment', () => {
    expect(evaluateSpend(spend(50), policy())).toMatchObject({ outcome: 'allowed', code: '' });
  });

  it('allows exactly the single-payment limit', () => {
    // The limit is what is permitted, not the first thing refused.
    expect(evaluateSpend(spend(100), policy())).toMatchObject({ outcome: 'allowed' });
  });

  it('allows spending that exactly exhausts the daily cap', () => {
    expect(evaluateSpend(spend(100), policy({ spentToday: 400 }))).toMatchObject({
      outcome: 'allowed',
    });
  });
});

describe('the caps', () => {
  it('refuses a payment above the single-payment limit', () => {
    const decision = evaluateSpend(spend(101), policy());

    expect(decision).toMatchObject({ outcome: 'rejected', code: 'exceeds_max_payment' });
    expect(decision.reason).toContain('100.00 single-payment limit');
  });

  it('refuses a payment that would pass the daily cap, and says what is left', () => {
    const decision = evaluateSpend(spend(80), policy({ spentToday: 450 }));

    expect(decision).toMatchObject({ outcome: 'rejected', code: 'exceeds_daily_cap' });
    expect(decision.reason).toContain('50.00 remains today');
  });

  it('counts spending already made rather than each payment alone', () => {
    // Five payments of 100 are each within the payment limit; the sixth is
    // not within the day.
    const spent = policy({ spentToday: 500 });
    expect(evaluateSpend(spend(1), spent)).toMatchObject({ code: 'exceeds_daily_cap' });
  });
});

describe('categories', () => {
  it('refuses a blocked category', () => {
    const decision = evaluateSpend(
      spend(10, 'gambling'),
      policy({ blockedCategories: ['gambling'] }),
    );
    expect(decision).toMatchObject({ outcome: 'rejected', code: 'category_blocked' });
  });

  it('refuses anything outside a configured allow-list', () => {
    const decision = evaluateSpend(
      spend(10, 'marketing'),
      policy({ allowedCategories: ['compute', 'data'] }),
    );
    expect(decision.reason).toContain('not in the permitted categories');
  });

  it('permits everything when no allow-list is configured', () => {
    // An empty list means unconfigured, not "nothing is allowed" — the
    // opposite reading locks out every borrower who never set one.
    expect(evaluateSpend(spend(10, 'anything'), policy())).toMatchObject({ outcome: 'allowed' });
  });

  it('compares categories case-insensitively', () => {
    expect(
      evaluateSpend(spend(10, 'Compute'), policy({ allowedCategories: ['compute'] })),
    ).toMatchObject({ outcome: 'allowed' });
    expect(
      evaluateSpend(spend(10, 'COMPUTE'), policy({ blockedCategories: ['compute'] })),
    ).toMatchObject({ outcome: 'rejected' });
  });

  it('blocking beats allowing for the same category', () => {
    const decision = evaluateSpend(
      spend(10, 'compute'),
      policy({ allowedCategories: ['compute'], blockedCategories: ['compute'] }),
    );
    expect(decision).toMatchObject({ outcome: 'rejected' });
  });
});

describe('the approval threshold', () => {
  it('queues an agent payment above the threshold', () => {
    const decision = evaluateSpend(spend(90, 'compute', false), policy({ maxPayment: 500 }));

    expect(decision).toMatchObject({ outcome: 'allowed' });

    const large = evaluateSpend(spend(300, 'compute', false), policy({ maxPayment: 500 }));
    expect(large).toMatchObject({ outcome: 'queued', code: 'needs_approval' });
  });

  it('does not ask the owner to approve themselves', () => {
    // A draw is made from an owner-authenticated session, so the signature
    // the threshold asks for has already been given.
    const decision = evaluateSpend(spend(300, 'compute', true), policy({ maxPayment: 500 }));
    expect(decision).toMatchObject({ outcome: 'allowed' });
  });
});
