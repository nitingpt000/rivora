'use client';

import { SEVERITY_COLOR, SEVERITY_GLYPH, num, pct, usdc } from '@rivora/core';
import { useDerived, useProtocol, type LimitRecommendation } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  ButtonRow,
  Card,
  DataTable,
  Delta,
  Grid,
  KeyValue,
  KeyValueList,
  Kicker,
  Mono,
  Page,
  PageHeader,
  Tag,
} from '@rivora/ui';
import Link from 'next/link';

import { dayTime } from '@/lib/format';

/** S-50 — Risk console overview. screens.md §10.1 */
export default function RiskOverviewPage() {
  const s = useProtocol();
  const d = useDerived();

  const alerts = s.riskAlerts ?? [];
  const watchlist = s.watchlist;

  // Across the borrowers the operator can see. Null until the watchlist lands,
  // so the cell reads as "not loaded" rather than as a mean of nothing.
  const meanScore =
    watchlist && watchlist.length > 0
      ? Math.round(watchlist.reduce((a, w) => a + w.score, 0) / watchlist.length)
      : null;

  // Counted across the book. The previous version read the *operator's own*
  // borrower status, which is not a thing an operator has.
  const restricted = watchlist?.filter((w) => w.status === 'RESTRICTED').length ?? 0;
  const critical = alerts.filter((a) => a.severity === 'restrict').length;
  const warnings = alerts.filter((a) => a.severity === 'warn').length;
  const info = alerts.filter((a) => a.severity === 'info').length;

  return (
    <Page measure="wide">
      <PageHeader
        title="Risk console"
        aside={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Tag tone="outline" color="var(--color-danger)">
              ⛔ {critical} critical
            </Tag>
            <Tag tone="outline" color="var(--color-warn)">
              ⚠ {warnings} warning
            </Tag>
            <Tag tone="neutral">ⓘ {info} info</Tag>
            <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
              Auto-refresh 10s
            </span>
          </div>
        }
      />

      <Blueprint style={{ marginBottom: 16 }}>
        <Kicker style={{ padding: '14px 20px 4px' }}>Alerts</Kicker>
        {alerts.map((a, i) => (
          <div
            key={`${a.who}-${i}`}
            style={{
              display: 'flex',
              gap: 14,
              padding: '12px 20px',
              borderBottom: '1px solid var(--color-neutral-200)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ width: 22, color: SEVERITY_COLOR[a.severity] }}>
              {SEVERITY_GLYPH[a.severity]}
            </span>
            <Mono style={{ width: 110, flexShrink: 0 }}>{a.who}</Mono>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13.5 }}>{a.text}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
                {[a.at ? dayTime(a.at) : null, a.meta].filter(Boolean).join(' · ')}
              </div>
            </div>
            {a.href && a.cta ? (
              <Link href={a.href}>
                <Button variant="secondary" compact>
                  {a.cta} →
                </Button>
              </Link>
            ) : null}
          </div>
        ))}
      </Blueprint>

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="Portfolio">
          <KeyValueList>
            <KeyValue
              label="Outstanding"
              value={`${usdc(d.outstandingProtocolWide)} USDC`}
            />
            <KeyValue label="Borrowers" value={String(s.activeBorrowers)} />
            <KeyValue
              label="On watch / restricted"
              value={`${s.onWatch} / ${restricted}`}
            />
            <KeyValue
              label="Defaulted (cumulative)"
              value={String(s.defaults?.count ?? 0)}
            />
            <KeyValue label="Mean score" value={meanScore === null ? '—' : String(meanScore)} />
            <KeyValue
              label="Realized losses"
              value={`${usdc(s.realizedLosses)} USDC`}
            />
          </KeyValueList>
        </Card>

        <Card kicker="Protocol health">
          <KeyValueList>
            <KeyValue label="Vault utilization" value={`${pct(d.utilization * 100)} ✓`} />
            <KeyValue label="Liquidity buffer" value={`${pct(d.bufferPct, 1)} ✓`} />
            <KeyValue label="Withdrawal queue" value={`${usdc(s.queueTotal)} ✓`} />
            <KeyValue
              label="Reserve / first-loss coverage"
              value={`${pct(share(s.protocolReserve, s.vaultAssets), 1)} / ${pct(share(s.firstLossTranche, s.vaultAssets), 1)}`}
            />
            <KeyValue
              label="Mean fulfilment"
              value={s.stats ? pct(s.stats.probeSuccessPct, 1) : '—'}
            />
            <KeyValue label="Mean uptime" value={s.stats ? pct(s.stats.meanUptimePct, 1) : '—'} />
          </KeyValueList>
        </Card>
      </Grid>

      <DataTable<LimitRecommendation>
        caption="Pending limit recommendations"
        rows={s.recommendations ?? []}
        rowKey={(r) => r.handle}
        empty="Every limit matches what the ladder produces today."
        style={{ marginBottom: 18 }}
        columns={[
          { key: 'id', header: 'Borrower', render: (r) => <Mono>{r.handle}</Mono> },
          {
            key: 'current',
            header: 'Current',
            align: 'right',
            render: (r) => <span className="tabular">{usdc(r.current)}</span>,
          },
          {
            key: 'recommended',
            header: 'Recommended',
            align: 'right',
            render: (r) => <span className="tabular">{usdc(r.recommended)}</span>,
          },
          {
            key: 'delta',
            header: 'Δ',
            align: 'right',
            render: (r) =>
              r.recommended === r.current ? '—' : <Delta value={r.recommended - r.current} />,
          },
          { key: 'binding', header: 'Binding', render: (r) => r.bindingKey },
          {
            key: 'action',
            header: 'Action',
            // A reduction is the one an operator should look at before acting:
            // it means the inputs have deteriorated since the last assessment.
            render: (r) =>
              r.direction === 'reduce' ? (
                <Link href={`/risk/borrower?handle=${encodeURIComponent(r.handle)}`}>
                  <Button variant="ghost" compact>
                    Review
                  </Button>
                </Link>
              ) : (
                <Button variant="secondary" compact>
                  Approve
                </Button>
              ),
          },
        ]}
      />

      <ButtonRow align="center">
        <Button variant="danger">Pause lending</Button>
        <Button variant="danger">Emergency debt freeze</Button>
        <Link href="/risk/params">
          <Button variant="ghost">Parameters</Button>
        </Link>
      </ButtonRow>

      <div
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--color-neutral-600)',
          marginTop: 12,
        }}
      >
        Emergency actions require {num(2, 0)} of 3 operator signatures and publish a reason string
        onchain.
      </div>
    </Page>
  );
}

/** A buffer as a percentage of total vault assets. */
function share(amount: number, assets: number): number {
  return assets > 0 ? (amount / assets) * 100 : 0;
}
