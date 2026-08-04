'use client';

import { usdc } from '@rivora/core';
import { useProtocol, type AnomalyEvidence } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  ButtonRow,
  Callout,
  CheckLine,
  DataTable,
  Grid,
  Kicker,
  Page,
  PageHeader,
  Section,
  Stack,
  TxChip,
} from '@rivora/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { dayTime, fullTime } from '@/lib/format';

interface ImpactRow {
  label: string;
  after: string;
  negative?: boolean;
}

/**
 * S-53 — Anomaly detail. screens.md §10.4
 *
 * The evidence table shows each observed finding, not just the verdict — it is
 * the artifact a disputing borrower sees, so it has to be arguable.
 */
export default function AnomalyPage() {
  const anomaly = useProtocol((s) => s.anomaly);

  if (!anomaly) {
    return (
      <Page measure="mid">
        <PageHeader
          back={<Link href="/risk">← Overview</Link>}
          title="Anomaly detail"
          size={28}
          aside={
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 14,
                letterSpacing: '0.08em',
                color: 'var(--color-neutral-600)',
              }}
            >
              ○ NONE DETECTED
            </span>
          }
        />
        <Blueprint style={{ padding: 24, fontSize: 14, color: 'var(--color-neutral-700)' }}>
          No anomaly has been detected. Detection runs continuously against settled revenue; a
          confirmed finding appears here with its evidence and the write-back it caused. Review open
          cases on the <Link href="/risk/watchlist">watchlist</Link>.
        </Blueprint>
      </Page>
    );
  }

  // Only the "after" side is recorded. Showing an invented "before" column
  // would put figures the protocol never stored beside ones it did.
  const impact: ImpactRow[] = [
    { label: 'Eligible revenue 30d', after: usdc(anomaly.after.eligibleRevenue), negative: true },
    { label: 'Risk score', after: String(anomaly.after.score), negative: true },
    { label: 'Tier', after: anomaly.after.tier },
    { label: 'Credit limit', after: usdc(anomaly.after.limit), negative: anomaly.after.limit === 0 },
    { label: 'Repayment share', after: `${anomaly.after.repaymentBps / 100}%` },
  ];

  return (
    <Page measure="mid">
      <PageHeader
        back={<Link href="/risk">← Overview</Link>}
        title={`Anomaly ${anomaly.reference} — ${anomaly.kind}`}
        size={28}
        aside={
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 14,
              letterSpacing: '0.08em',
              color: 'var(--color-danger)',
            }}
          >
            ⛔ CONFIRMED
          </span>
        }
        lead={`Borrower ${anomaly.borrower} · detected ${fullTime(anomaly.detectedAt)}`}
      />

      <Section title="Finding" style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, margin: '0 0 20px', maxWidth: '78ch' }}>
          {anomaly.payerCount} payer wallets contributing {usdc(anomaly.washAmount)} USDC over{' '}
          {anomaly.daysSpanned} days were first funded by the borrower&rsquo;s own operating wallet
          shortly before their first payment. The funding graph shows a closed loop.
        </p>

        <Kicker style={{ marginBottom: 14 }}>Funding graph</Kicker>
        <div style={{ display: 'grid', justifyItems: 'center', fontSize: 12.5 }}>
          <GraphNode accent>
            {anomaly.borrower}{' '}
            <span style={{ fontFamily: 'var(--font-body)', color: 'var(--color-neutral-600)' }}>
              operating wallet
            </span>
          </GraphNode>
          <Connector />
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            {anomaly.fundedWallets.map((w) => (
              <div key={w.address} style={{ textAlign: 'center' }}>
                <GraphNode>{w.address}</GraphNode>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                  funded {w.fundedOn} · {usdc(w.amount)}
                </div>
              </div>
            ))}
          </div>
          <Connector />
          <GraphNode accent>
            revenue router{' '}
            <span style={{ fontFamily: 'var(--font-body)', color: 'var(--color-neutral-600)' }}>
              {usdc(anomaly.washAmount)} received
            </span>
          </GraphNode>
          <Connector />
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
            operating share returns to the funding wallet — loop closed
          </div>
        </div>

        {anomaly.netEconomicRevenue === null ? (
          <Callout severity="warn">
            Net economic revenue from these payers was <strong>not measured</strong>. Establishing
            it needs the payers&rsquo; own transaction costs, which the protocol cannot see — so
            this finding rests on the funding pattern and the excluded amount, not on proving the
            activity ran at a loss.
          </Callout>
        ) : (
          <Callout severity="danger">
            Net economic revenue from these payers:{' '}
            <strong>{usdc(anomaly.netEconomicRevenue)} USDC</strong> after routing costs. The
            borrower paid itself at a loss.
          </Callout>
        )}
      </Section>

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <DataTable<AnomalyEvidence>
          caption="Evidence"
          rows={anomaly.evidence}
          rowKey={(e, i) => `${e.at}-${i}`}
          columns={[
            { key: 'finding', header: 'Finding', render: (e) => e.finding },
            {
              key: 'at',
              header: 'Observed',
              render: (e) => (
                <span style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{dayTime(e.at)}</span>
              ),
            },
            {
              key: 'detail',
              header: 'Detail',
              render: (e) => (
                <span style={{ fontSize: 12.5 }}>
                  {e.detail} {e.tx ? <TxChip hash={e.tx} /> : null}
                </span>
              ),
            },
          ]}
        />

        <DataTable<ImpactRow>
          caption="State after write-back"
          rows={impact}
          rowKey={(r) => r.label}
          columns={[
            { key: 'label', header: '', render: (r) => r.label },
            {
              key: 'after',
              header: 'After',
              align: 'right',
              render: (r) => (
                <span
                  className="tabular"
                  style={{ color: r.negative ? 'var(--color-danger)' : undefined }}
                >
                  {r.after}
                </span>
              ),
            },
          ]}
        />
      </Grid>

      <Section title="Automated response" style={{ marginBottom: 14 }}>
        <Stack gap={5} style={{ fontSize: 13 }}>
          <CheckLine mark="pass">
            {usdc(anomaly.washAmount)} excluded from eligible revenue
          </CheckLine>
          <CheckLine mark="pass">
            Credit limit reduced to {usdc(anomaly.after.limit)} · new draws blocked
          </CheckLine>
          <CheckLine mark="pass">
            Repayment share raised to {anomaly.after.repaymentBps / 100}% · borrower notified
          </CheckLine>
          <CheckLine mark="pass">
            Evidence hash {anomaly.evidenceHash} written onchain <TxChip hash={anomaly.txHash} />
          </CheckLine>
        </Stack>
      </Section>

      <ButtonRow align="start">
        <Button variant="ghost" compact>
          Add note
        </Button>
        <Button variant="ghost" compact>
          Mark false positive
        </Button>
        <Link href={`/risk/declare?handle=${encodeURIComponent(anomaly.borrower)}`}>
          <Button variant="danger" compact>
            Escalate to default →
          </Button>
        </Link>
      </ButtonRow>
    </Page>
  );
}

function GraphNode({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        border: `1px solid ${accent ? 'var(--color-accent)' : 'var(--color-neutral-500)'}`,
        padding: accent ? '8px 18px' : '6px 12px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </div>
  );
}

function Connector() {
  return <div style={{ width: 1, height: 18, background: 'var(--color-neutral-500)' }} />;
}
