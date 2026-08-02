'use client';

import { num, pct, usdc } from '@rivora/core';
import { useProtocol, type RevenueCustomer } from '@rivora/protocol-sim';
import { BarRow, Button, ButtonRow, DataTable, Mono, Page, PageHeader, Section, Stack } from '@rivora/ui';
import Link from 'next/link';

import { Loading } from '@/components/loading';
import { day } from '@/lib/format';

/**
 * S-22 — Excluded revenue detail. screens.md §8.3
 *
 * PRD §22.2 requires every excluded payment to carry a reason. That is what
 * this screen is: not a summary of what was removed, but the evidence for each
 * removal, in a form the borrower can dispute.
 */
export default function ExcludedRevenuePage() {
  const excluded = useProtocol((s) => s.excluded);
  const revenue = useProtocol((s) => s.revenue);

  if (!excluded || !revenue) return <Loading label="Reading exclusions" />;

  // Reasons come back keyed by the exclusion rule that fired, so the breakdown
  // is whatever the protocol actually applied rather than a fixed list that
  // could omit a rule added later.
  const reasons = Object.entries(excluded.byReason).sort((a, b) => b[1] - a[1]);
  const excludedPct = revenue.gross > 0 ? (excluded.total / revenue.gross) * 100 : 0;

  return (
    <Page measure="mid">
      <PageHeader
        back={<Link href="/revenue">← Revenue</Link>}
        title="Excluded revenue"
        lead={`${usdc(excluded.total)} USDC excluded from ${usdc(revenue.gross)} gross · ${pct(excludedPct, 1)} · window ${day(revenue.windowStart)} → ${day(revenue.windowEnd)}`}
      />

      <Section style={{ marginBottom: 16 }}>
        {reasons.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: 0 }}>
            Nothing has been excluded from this window.
          </p>
        ) : (
          <Stack gap={8}>
            {reasons.map(([label, amount]) => (
              <BarRow
                key={label}
                label={label}
                value={usdc(amount)}
                ratio={excluded.total > 0 ? amount / excluded.total : 0}
                trailing={pct(excluded.total > 0 ? (amount / excluded.total) * 100 : 0, 1)}
                labelWidth={240}
                valueWidth={90}
                barMaxWidth={300}
              />
            ))}
          </Stack>
        )}
      </Section>

      <DataTable<RevenueCustomer>
        caption="Excluded payers"
        rows={excluded.payers}
        rowKey={(p) => p.label}
        empty="No payer has been excluded from this window."
        columns={[
          {
            key: 'firstSeen',
            header: 'First seen',
            render: (p) => (
              <span style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{day(p.firstSeenAt)}</span>
            ),
          },
          { key: 'payer', header: 'Payer', render: (p) => <Mono>{p.label}</Mono> },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (p) => <span className="tabular">{usdc(p.revenue30d)}</span>,
          },
          {
            key: 'requests',
            header: 'Requests',
            align: 'right',
            render: (p) => <span className="tabular">{num(p.requests30d, 0)}</span>,
          },
          {
            key: 'share',
            header: 'Share of gross',
            align: 'right',
            render: (p) => <span className="tabular">{pct(p.sharePct, 1)}</span>,
          },
        ]}
        footer={
          <ButtonRow style={{ width: '100%' }}>
            <Button variant="secondary" compact>
              Dispute
            </Button>
          </ButtonRow>
        }
      />
    </Page>
  );
}
