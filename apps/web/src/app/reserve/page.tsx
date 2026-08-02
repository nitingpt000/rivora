'use client';

import { pct, usdc } from '@rivora/core';
import { useDerived, useProtocol, type ReserveEvent } from '@rivora/protocol-sim';
import {
  Button,
  DataTable,
  Delta,
  Meter,
  Note,
  Page,
  PageHeader,
  Section,
  Stat,
  TxChip,
} from '@rivora/ui';

import { day } from '@/lib/format';

/** S-31 — Reserve and security bond. screens.md §8.12 */
export default function ReservePage() {
  const s = useProtocol();
  const d = useDerived();
  const activity = s.reserveStatus?.activity ?? [];

  // Signed amounts, so contributions and applications separate by sign rather
  // than by a label that could disagree with the figure beside it.
  const contributed = activity.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0);
  const applied = activity.filter((r) => r.amount < 0).reduce((a, r) => a - r.amount, 0);

  return (
    <Page measure="form">
      <PageHeader title="Reserve and bond" />

      <Section title="Borrower loss reserve" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 36, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Stat label="Balance" value={`${usdc(s.reserve)} USDC`} size={28} />
          <Stat label="Target" value={`${usdc(s.reserveTarget)} USDC`} size={28} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
              Coverage {pct(d.reserveCoverageRatio * 100, 1)}
            </div>
            <Meter ratio={d.reserveCoverageRatio} height={10} style={{ marginTop: 6 }} />
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', margin: '14px 0 6px' }}>
          Funded at {pct(s.reserveStatus?.contributionSharePct ?? s.reserveBps / 100, 0)} of settled
          revenue · ~{usdc(s.reserveStatus?.dailyContribution ?? 0)} USDC/day. May be applied to: missed
          repayment · temporary revenue decline · refunds · protocol-defined borrower losses.
        </p>
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
          Release available 30 days after outstanding debt reaches zero.{' '}
          <Button variant="ghost" compact disabled={d.hasDebt}>
            Request release
          </Button>
          {d.hasDebt ? ` — disabled, outstanding debt ${usdc(d.owed)}` : ''}
        </div>
      </Section>

      <Section title="Security bond" style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: '0 0 10px' }}>
          Required for custody models B and C, and above tier thresholds. Your custody model is A and
          your limit is below the bond threshold.
        </p>
        <div
          style={{ display: 'flex', gap: 36, fontSize: 14, flexWrap: 'wrap' }}
          className="tabular"
        >
          <span>
            Posted <strong>0.00 USDC</strong>
          </span>
          <span>
            Required <strong>0.00 USDC</strong>
          </span>
          <span style={{ color: 'var(--color-ok)' }}>✓ not required</span>
        </div>
        <Note>
          ⓘ Posting a voluntary bond raises your effective limit ceiling under the custody cap — the
          cap for a weaker custody model is bounded by reserve plus bond.
        </Note>
      </Section>

      <DataTable<ReserveEvent>
        caption="Reserve activity"
        rows={activity}
        rowKey={(r) => `${r.at}-${r.type}`}
        empty="No reserve movement recorded yet."
        columns={[
          { key: 'date', header: 'Date', render: (r) => day(r.at) },
          { key: 'event', header: 'Event', render: (r) => r.note ?? r.type },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (r) => <Delta value={r.amount} decimals={2} />,
          },
          {
            key: 'balance',
            header: 'Balance',
            align: 'right',
            render: (r) => <span className="tabular">{usdc(r.balance)}</span>,
          },
          { key: 'tx', header: 'Tx', render: (r) => (r.tx ? <TxChip hash={r.tx} /> : <span>—</span>) },
        ]}
        footer={
          <span>
            Contributed {usdc(contributed)} · applied {usdc(applied)}
          </span>
        }
      />
    </Page>
  );
}
