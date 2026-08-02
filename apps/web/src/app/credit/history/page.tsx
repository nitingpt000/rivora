'use client';

import { usdc } from '@rivora/core';
import { useProtocol, type AssessmentHistoryEntry } from '@rivora/protocol-sim';
import { DataTable, Delta, Page, PageHeader, Section, StepChart } from '@rivora/ui';
import Link from 'next/link';

import { Loading } from '@/components/loading';
import { dayTime } from '@/lib/format';

/** S-28 — Credit limit history. screens.md §8.9 */
export default function LimitHistoryPage() {
  const history = useProtocol((s) => s.history);
  const registeredAt = useProtocol((s) => s.profile?.registeredAt);

  if (!history) return <Loading label="Reading assessment history" />;

  // Oldest first, so the chart reads left to right the way time does.
  const timeline = [...history].reverse();
  const ceiling = Math.max(...timeline.map((r) => r.limit), 1);

  // Registration opens the line at zero. Without that leading step the chart
  // would start at the first approval and imply credit that never existed.
  const steps = [
    { widthPct: 100 / (timeline.length + 1), heightPct: 0, axis: dayTime(registeredAt) },
    ...timeline.map((entry, index) => ({
      widthPct: 100 / (timeline.length + 1),
      heightPct: Math.round((entry.limit / ceiling) * 100),
      label: entry.limit.toFixed(0),
      axis: `▲ assessment ${index + 1} · ${dayTime(entry.at)}`,
    })),
  ];

  return (
    <Page measure="narrow">
      <PageHeader back={<Link href="/credit">← Credit</Link>} title="Credit limit history" />

      {timeline.length ? (
        <Section style={{ marginBottom: 16 }}>
          <StepChart steps={steps} />
        </Section>
      ) : null}

      <DataTable<AssessmentHistoryEntry>
        rows={history}
        rowKey={(r) => r.at}
        empty="No assessment has been recorded yet."
        columns={[
          { key: 'date', header: 'Date', render: (r) => dayTime(r.at) },
          {
            key: 'n',
            header: '#',
            // Numbered from the oldest, so an assessment keeps its number as
            // new ones land above it.
            render: (_r, i) => String(history.length - i),
          },
          {
            key: 'limit',
            header: 'Limit',
            align: 'right',
            render: (r) => <span className="tabular">{usdc(r.limit)}</span>,
          },
          {
            key: 'delta',
            header: 'Δ',
            align: 'right',
            render: (r) =>
              r.previousLimit ? <Delta value={r.limit - r.previousLimit} decimals={2} /> : '—',
          },
          { key: 'score', header: 'Score', render: (r) => String(r.score) },
          { key: 'tier', header: 'Tier', render: (r) => r.tier },
          { key: 'binding', header: 'Binding', render: (r) => r.bindingKey },
        ]}
        footer={
          <span>
            Assessments run on a 14-day schedule, and also trigger on: material revenue change,
            default warning, large refund, suspicious activity, complete repayment.
          </span>
        }
      />
    </Page>
  );
}
