'use client';

import { STATUS_COLOR, num, usdc } from '@rivora/core';
import type { BorrowerStatus } from '@rivora/core';
import { useProtocol, type WatchlistEntry } from '@rivora/protocol-sim';
import { Button, ButtonRow, DataTable, Mono, Page, PageHeader } from '@rivora/ui';
import { useRouter } from 'next/navigation';

import { Loading } from '@/components/loading';

/** S-51 — Watchlist. screens.md §10.2 */
export default function WatchlistPage() {
  const rows = useProtocol((s) => s.watchlist);
  const router = useRouter();

  if (!rows) return <Loading label="Reading the watchlist" />;

  const atRisk = rows
    .filter((r) => r.status === 'WATCH' || r.status === 'RESTRICTED')
    .reduce((a, r) => a + r.principal, 0);
  const bookTotal = rows.reduce((a, r) => a + r.principal, 0) || 1;

  return (
    <Page measure="wide">
      <PageHeader
        title="Watchlist"
        aside={
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            Sort · principal at risk ▾ · {rows.length} shown
          </span>
        }
      />

      <DataTable<WatchlistEntry>
        rows={rows}
        rowKey={(r) => r.handle}
        empty="No borrower needs attention."
        onRowClick={(r) => router.push(`/risk/borrower?handle=${encodeURIComponent(r.handle)}`)}
        style={{ marginBottom: 14 }}
        columns={[
          { key: 'id', header: 'Borrower', render: (r) => <Mono>{r.handle}</Mono> },
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <span
                style={{
                  color: STATUS_COLOR[r.status as BorrowerStatus] ?? 'var(--color-text)',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 12.5,
                  letterSpacing: '0.04em',
                }}
              >
                {r.status}
              </span>
            ),
          },
          {
            key: 'score',
            header: 'Score',
            align: 'right',
            // The delta is what an operator scans for: a score of 62 matters
            // much less than a score of 62 that was 71 yesterday.
            render: (r) =>
              r.scoreDelta === 0
                ? String(r.score)
                : `${r.score} ${r.scoreDelta < 0 ? '▼' : '▲'}${Math.abs(r.scoreDelta)}`,
          },
          {
            key: 'principal',
            header: 'Principal',
            align: 'right',
            render: (r) => <span className="tabular">{usdc(r.principal)}</span>,
          },
          {
            key: 'coverage',
            header: 'Cov',
            align: 'right',
            render: (r) => <span className="tabular">{num(r.coverageRatio, 2)}</span>,
          },
          { key: 'tier', header: 'Tier', render: (r) => r.tier },
          {
            key: 'trigger',
            header: 'Trigger',
            render: (r) => <span style={{ fontSize: 12.5 }}>{r.trigger}</span>,
          },
        ]}
        footer={
          <>
            <span>
              Principal at risk (WATCH + RESTRICTED) <strong>{usdc(atRisk)}</strong> USDC ·{' '}
              {((atRisk / bookTotal) * 100).toFixed(1)}% of book
            </span>
            <span>
              Covered by reserves + first loss <strong>3,161.20</strong> · 91.4%
            </span>
          </>
        }
      />

      <ButtonRow align="start">
        <Button variant="ghost" compact>
          Reassess selected
        </Button>
        <Button variant="ghost" compact>
          Freeze draws
        </Button>
        <Button variant="ghost" compact>
          Notify borrowers
        </Button>
      </ButtonRow>
    </Page>
  );
}
