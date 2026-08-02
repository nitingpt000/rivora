'use client';

import { pct, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';

import { Loading } from '@/components/loading';
import {
  Card,
  Grid,
  KeyValue,
  KeyValueList,
  Note,
  Page,
  PageHeader,
  Section,
  Stack,
  StepChart,
  Tag,
} from '@rivora/ui';

/** S-44 — Vault performance and losses. screens.md §9.5 */
export default function PerformancePage() {
  const s = useProtocol();
  const d = useDerived();
  const perf = s.performance;

  if (!perf) return <Loading label="Reading vault performance" />;

  return (
    <Page measure="mid">
      <PageHeader title="Vault performance" aside={<Tag tone="neutral">Since inception</Tag>} />

      <Section title={`Share price — ${s.sharePrice.toFixed(6)}`} style={{ marginBottom: 14 }}>
        <StepChart
          height={80}
          steps={[
            { widthPct: 34, heightPct: 10, axis: 'Jun 01' },
            { widthPct: 44, heightPct: 40, axis: '' },
            { widthPct: 22, heightPct: 66, label: s.sharePrice.toFixed(6), axis: 'Aug 02' },
          ]}
        />
        <Note>
          ⓘ No loss event has occurred. A realized loss appears here as a step down — losses are
          applied to share value at the moment they are realized, including to queued positions.
        </Note>
      </Section>

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="Returns">
          <KeyValueList>
            <KeyValue label="Interest generated" value={`${usdc(s.interestGenerated)} USDC`} />
            <KeyValue
              label="Protocol spread taken"
              value={`${usdc(perf.protocolSpreadTaken)} USDC`}
            />
            <KeyValue label="Subsidy paid in" value={`${usdc(perf.subsidyPaidIn)} USDC`} />
            <KeyValue label="Net to LPs" value={`${usdc(perf.netToLps)} USDC`} strong />
            <KeyValue
              label="Organic APY"
              value={pct(perf.organicApyPct)}
              style={{ marginTop: 6 }}
            />
            <KeyValue label="Displayed APY" value={pct(perf.displayedApyPct)} />
            <KeyValue label="Since inception" value="+0.76%" />
          </KeyValueList>
        </Card>

        <Card kicker="Credit performance">
          <KeyValueList>
            <KeyValue
              label="Principal originated"
              value={usdc(perf.principalOriginated)}
            />
            <KeyValue label="Principal repaid" value={usdc(s.principalRepaid)} />
            <KeyValue label="Outstanding" value={usdc(d.outstandingProtocolWide)} />
            <KeyValue
              label="Repaid from routed revenue"
              value={s.stats ? pct(s.stats.repaidFromRevenuePct, 1) : '—'}
            />
            <KeyValue label="Default rate" value={s.stats ? pct(s.stats.defaultRatePct, 2) : '—'} />
            <KeyValue label="Borrowers on watch" value={String(s.onWatch)} />
            <KeyValue label="Realized losses" value={usdc(s.realizedLosses)} />
          </KeyValueList>
        </Card>
      </Grid>

      <Section title="Loss history">
        <p style={{ fontSize: 13.5, margin: '0 0 12px' }}>
          No losses realized. When a loss occurs it is applied in this order:
        </p>
        <Stack gap={5} style={{ fontSize: 13, maxWidth: 520 }}>
          <KeyValue label="1  Borrower loss reserve" value="" />
          <KeyValue
            label="2  Protocol first-loss tranche"
            value={`${usdc(s.firstLossTranche)} available`}
          />
          <KeyValue
            label="3  Protocol loss reserve"
            value={`${usdc(s.protocolReserve)} available`}
          />
          <KeyValue label="4  Liquidity-provider shares" value="socialized proportionally" />
        </Stack>
        <Note>
          Cohort-1 liquidity providers are protected by the first-loss tranche until cohort-1
          borrowers complete three repayment cycles each. Queueing a withdrawal does not escape a
          loss realized before the claim is made.
        </Note>
      </Section>
    </Page>
  );
}
