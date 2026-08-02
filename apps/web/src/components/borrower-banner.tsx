'use client';

import { usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import { Banner, Button } from '@rivora/ui';
import Link from 'next/link';

/**
 * The state banner shown above borrower page content.
 *
 * screens.md §5.2 and §8.13 treat this as required chrome: a borrower in a
 * degraded state must be told what changed, what it costs them and what returns
 * them to ACTIVE — on every screen, not only the one that detected it.
 */
export function BorrowerBanner() {
  const s = useProtocol();
  const d = useDerived();

  if (s.status === 'WATCH') {
    const copy =
      s.watchReason === 'concentration'
        ? {
            title: 'Customer concentration rose above 40%',
            body: 'New draws are still permitted at a reduced limit. Concentration must fall below 40% for two consecutive assessments to return to ACTIVE.',
          }
        : {
            title: 'Revenue declined materially over 30 days',
            body: `Credit limit reduced ${usdc(s.previousLimit)} → ${usdc(s.limit)}. Borrowing continues at the reduced limit. Recovery: two consecutive assessments with growth above −10%.`,
          };

    return (
      <Banner
        severity="warn"
        title={`WATCH — ${copy.title}`}
        actions={
          <>
            <Link href="/credit/assessment">
              <Button variant="ghost" compact>
                What changed?
              </Button>
            </Link>
            <Link href="/revenue">
              <Button variant="ghost" compact>
                Revenue detail
              </Button>
            </Link>
          </>
        }
      >
        {copy.body}
      </Banner>
    );
  }

  if (s.status === 'RESTRICTED') {
    const binding = s.restrictReason === 'binding';
    return (
      <Banner
        severity="restrict"
        emphasis
        title={`RESTRICTED — ${binding ? 'Binding broken' : 'Manufactured revenue detected'}`}
        actions={
          <>
            <Link href={binding ? '/custody' : '/risk/anomaly'}>
              <Button variant="secondary" compact>
                See evidence
              </Button>
            </Link>
            <Button variant="ghost" compact>
              Dispute
            </Button>
          </>
        }
      >
        {binding ? (
          <>
            Advertised payTo <span className="mono">0x91bd…7702</span> no longer matches your Revenue
            Router <span className="mono">0x7f3a…c1d2</span>. New draws are blocked and the
            repayment share has been raised to 35%. Restore the binding within 7 days to avoid
            default.
          </>
        ) : (
          <>
            3 payer wallets contributing 2,400.00 USDC were funded by your own operating wallet
            within 7 days of their first payment. Credit limit → 0.00 · new draws blocked · repayment
            share 20% → 35%. Outstanding {usdc(s.principal)} USDC continues repaying from routed
            revenue.
          </>
        )}
      </Banner>
    );
  }

  if (s.status === 'REPAID' && !d.hasDebt) {
    return (
      <Banner severity="ok" title="REPAID — credit line fully repaid">
        Revenue allocation is now 0/2/98 until the reserve target is met. Reassessment has been
        triggered and your reputation record updated. You may draw again at any time.
      </Banner>
    );
  }

  return null;
}
