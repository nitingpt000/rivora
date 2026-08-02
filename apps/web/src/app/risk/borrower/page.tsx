'use client';

import { num, pct, usdc } from '@rivora/core';
import type { BorrowerStatus } from '@rivora/core';
import { useProtocol, type ScoreComponent } from '@rivora/protocol-sim';
import {
  Button,
  ButtonRow,
  Callout,
  Card,
  DataTable,
  Delta,
  Grid,
  KeyValue,
  KeyValueList,
  Mono,
  Note,
  Page,
  PageHeader,
  Section,
  Stack,
  StatusPill,
  TxChip,
} from '@rivora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { Loading } from '@/components/loading';
import { dayTime, fullTime } from '@/lib/format';

/** S-52 — Borrower risk detail. screens.md §10.3 */
export default function BorrowerRiskDetailPage() {
  return (
    <Suspense fallback={<Loading label="Reading the borrower record" />}>
      <BorrowerRiskDetail />
    </Suspense>
  );
}

function BorrowerRiskDetail() {
  const params = useSearchParams();
  const handle = params.get('handle') ?? '';

  const b = useProtocol((s) => s.riskBorrower);
  const load = useProtocol((s) => s.loadRiskBorrower);

  useEffect(() => {
    void load(handle);
  }, [handle, load]);

  if (!handle) {
    return (
      <Page measure="mid">
        <Callout severity="info">
          Pick a borrower from the <Link href="/risk/watchlist">watchlist</Link> to see their record.
        </Callout>
      </Page>
    );
  }

  if (!b) return <Loading label="Reading the borrower record" />;

  return (
    <Page measure="mid">
      <PageHeader
        back={<Link href="/risk/watchlist">← Watchlist</Link>}
        title={
          <>
            <Mono size={20}>{b.handle}</Mono> · {b.serviceName}
          </>
        }
        size={26}
        aside={<StatusPill status={b.status as BorrowerStatus} />}
        lead={[
          b.operator ? `Operator ${b.operator}` : 'Agent-operated',
          b.jurisdiction,
          b.kybVerifiedAt ? `KYB verified ${fullTime(b.kybVerifiedAt)}` : 'KYB not verified',
          'this view is access-logged',
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="Position">
          <KeyValueList>
            <KeyValue label="Principal" value={`${usdc(b.principal)} USDC`} />
            <KeyValue label="Accrued interest" value={`${usdc(b.accruedInterest)} USDC`} />
            <KeyValue label="Limit" value={`${usdc(b.limit)} USDC`} />
            <KeyValue label="Reserve" value={`${usdc(b.reserve)} USDC`} />
            <KeyValue label="Repayment share" value={pct(b.repaymentSharePct, 0)} />
            <KeyValue label="Rate" value={pct(b.ratePct)} />
            <KeyValue label="Coverage ratio" value={num(b.coverageRatio, 2)} />
          </KeyValueList>
        </Card>

        <Card kicker="Exact factors">
          <KeyValueList style={{ fontFamily: 'var(--font-mono)' }}>
            <KeyValue label="S reliability" value={num(b.factors.S, 3)} />
            <KeyValue label="C concentration" value={num(b.factors.C, 3)} />
            <KeyValue label="V volatility" value={num(b.factors.V, 3)} />
            <KeyValue label="D diversity" value={num(b.factors.D, 3)} />
            <KeyValue label="M operating capacity" value={num(b.factors.M, 3)} />
            <KeyValue label="G growth · HHI" value={`${num(b.factors.G, 2)} · ${num(b.hhi, 2)}`} />
          </KeyValueList>
          <Note style={{ marginTop: 8 }}>
            Operators see exact values; borrowers, LPs and the public see bucketed bands.
          </Note>
        </Card>
      </Grid>

      <DataTable<ScoreComponent>
        caption="Score components"
        rows={b.components}
        rowKey={(c) => c.key}
        style={{ marginBottom: 14 }}
        columns={[
          { key: 'label', header: 'Signal', render: (c) => c.label },
          {
            key: 'weight',
            header: 'Weight',
            align: 'right',
            render: (c) => <span className="tabular">{pct(c.weight * 100, 0)}</span>,
          },
          {
            key: 'value',
            header: 'Value',
            align: 'right',
            render: (c) => <span className="tabular">{num(c.value, 3)}</span>,
          },
          {
            key: 'contribution',
            header: 'Contrib',
            align: 'right',
            render: (c) => <span className="tabular">{num(c.contribution, 2)}</span>,
          },
        ]}
        footer={
          <span>
            Risk score <strong>{b.score}</strong> · <Delta value={b.scoreDelta} /> since the previous
            assessment
          </span>
        }
      />

      <Section title="Timeline" style={{ marginBottom: 14 }}>
        <Stack gap={7} style={{ fontSize: 13 }}>
          {b.timeline.length === 0 ? (
            <span style={{ color: 'var(--color-neutral-600)' }}>Nothing recorded yet.</span>
          ) : null}
          {b.timeline.map((entry, i) => (
            <div key={`${entry.at}-${i}`}>
              <strong>{dayTime(entry.at)}</strong> {entry.text}{' '}
              {entry.tx ? <TxChip hash={entry.tx} /> : null}
            </div>
          ))}
        </Stack>
      </Section>

      <Section title="Actions">
        <ButtonRow align="start" style={{ gap: 8 }}>
          <Button variant="ghost" compact>
            Force reassessment
          </Button>
          <Button variant="ghost" compact>
            Adjust repayment share
          </Button>
          <Button variant="ghost" compact>
            Add note
          </Button>
          <Button variant="danger" compact>
            Restrict
          </Button>
          <Link href={`/risk/declare?handle=${encodeURIComponent(b.handle)}`}>
            <Button variant="danger" compact>
              Declare default →
            </Button>
          </Link>
          <Button variant="ghost" compact>
            Release restriction
          </Button>
        </ButtonRow>
        <Note>
          ⓘ Every action here is access-logged with operator identity and reason. Restriction release
          requires a second operator signature.
        </Note>
      </Section>
    </Page>
  );
}
