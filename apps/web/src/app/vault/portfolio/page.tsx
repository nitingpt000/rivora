'use client';

import { CUSTODY_LABEL, CUSTODY_MULTIPLIER, num, pct, usdc } from '@rivora/core';
import type { CustodyModel } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  BarRow,
  Callout,
  Card,
  Grid,
  KeyValue,
  KeyValueList,
  Note,
  Page,
  PageHeader,
  Section,
  Stack,
  Stat,
} from '@rivora/ui';

/**
 * S-43 — Portfolio composition. screens.md §9.4
 *
 * The privacy boundary made visible. LPs get composition and performance;
 * individual borrower revenue and identity never appear here (PRD §21.5). It
 * mirrors how a credit fund reports to investors: portfolio, not obligor books.
 */
export default function PortfolioPage() {
  const s = useProtocol();
  const perf = s.performance;

  // Read from the same rows the tables render, so the prose cannot contradict
  // the figures directly above it.
  const breachedSector = perf?.bySector.find((sector) => sector.breached) ?? null;
  const topUpstream = perf?.upstream[0] ?? null;

  const enforceability = (perf?.byCustody ?? []).reduce(
    (sum, row) => sum + CUSTODY_MULTIPLIER[row.model as CustodyModel] * (row.sharePct / 100),
    0,
  );
  const d = useDerived();

  const loanBook = [
    { tier: 'Prime', value: 0 },
    { tier: 'Strong', value: 4_120 + Math.max(0, s.principal - 2_000) },
    { tier: 'Standard', value: 3_510 },
    { tier: 'Watch', value: 840 },
    { tier: 'Restricted', value: s.anomalyDetected ? s.principal : 0 },
  ];
  const bookTotal = loanBook.reduce((a, l) => a + l.value, 0) || 1;

  return (
    <Page measure="mid">
      <PageHeader
        title="Portfolio composition"
        aside={
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>As of 2026-08-02</span>
        }
      />

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="By tier">
          <Stack gap={7} style={{ marginTop: 8 }}>
            {loanBook.map((l) => (
              <BarRow
                key={l.tier}
                label={l.tier}
                value={usdc(l.value)}
                ratio={l.value / bookTotal}
                trailing={pct((l.value / bookTotal) * 100, 1)}
                labelWidth={80}
                valueWidth={80}
                barMaxWidth={200}
              />
            ))}
          </Stack>
        </Card>

        <Card kicker="By custody model">
          <KeyValueList>
            {(perf?.byCustody ?? []).map((row) => (
              <KeyValue
                key={row.model}
                label={`${row.model} — ${CUSTODY_LABEL[row.model as CustodyModel]}`}
                value={`${usdc(row.principal)} · ${pct(row.sharePct, 1)}`}
              />
            ))}
            <KeyValue
              label="Weighted enforceability"
              // The custody multipliers the limit is built from, weighted by
              // principal — so this is the same number the underwriter uses.
              value={<strong>{num(enforceability, 2)}</strong>}
              divider
            />
          </KeyValueList>
          <Note style={{ marginTop: 10 }}>
            A borrower whose revenue provably cannot be diverted is a different credit from one whose
            revenue merely has not been diverted yet.
          </Note>
        </Card>
      </Grid>

      <Section title="By sector" style={{ marginBottom: 14 }}>
        <Stack gap={7}>
          {(perf?.bySector ?? []).map((sector) => (
            <BarRow
              key={sector.sector}
              label={sector.sector}
              value={usdc(sector.principal)}
              ratio={sector.sharePct / 100}
              trailing={pct(sector.sharePct, 1)}
              labelWidth={280}
              valueWidth={90}
              barMaxWidth={260}
            />
          ))}
        </Stack>
        {breachedSector ? (
          <Callout severity="warn">
            Sector exposure cap {pct(breachedSector.capPct, 0)} — {breachedSector.sector} at{' '}
            {pct(breachedSector.sharePct, 1)}, above cap. New draws in this sector are blocked until
            exposure falls below the cap.
          </Callout>
        ) : null}
      </Section>

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="By borrower size band">
          <KeyValueList>
            <KeyValue label="Under 1,000" value="2 borrowers · 9.9%" />
            <KeyValue label="1,000 – 2,500" value="3 borrowers · 31.1%" />
            <KeyValue label="2,500 – 5,000" value="2 borrowers · 59.0%" />
            <KeyValue label="Over 5,000" value="0 borrowers · 0.0%" />
          </KeyValueList>
          <div
            style={{
              borderTop: '1px solid var(--color-neutral-300)',
              marginTop: 10,
              paddingTop: 8,
              fontSize: 12.5,
              color: 'var(--color-neutral-700)',
            }}
          >
            Largest single borrower 2,400.00 — 9.6% of vault ⚠ above the 5% cap → that
            borrower&rsquo;s limit is frozen.
          </div>
        </Card>

        <Card kicker="Upstream dependency">
          <KeyValueList>
            {(perf?.upstream ?? []).map((u) => (
              <KeyValue
                key={u.name}
                label={u.name}
                value={`${pct(u.sharePct, 1)}${u.substitutable ? '' : ' ⚠ not substitutable'}`}
              />
            ))}
          </KeyValueList>
          <div
            style={{
              borderTop: '1px solid var(--color-neutral-300)',
              marginTop: 10,
              paddingTop: 8,
              fontSize: 12.5,
              color: 'var(--color-neutral-700)',
            }}
          >
            {topUpstream
              ? `⚠ A shock at ${topUpstream.name} would impair ${pct(topUpstream.sharePct, 1)} of the book at once. Diversifying across borrowers does not diversify this.`
              : 'No upstream dependency has been declared.'}
          </div>
        </Card>
      </Grid>

      <Section title="Portfolio revenue coverage">
        <Grid cols={4}>
          <Stat
            label="Aggregate routed revenue, 30d"
            value={usdc(s.routedRevenue30d)}
            size={19}
          />
          <Stat label="Outstanding principal" value={usdc(d.outstandingProtocolWide)} size={19} />
          <Stat label="Coverage multiple" value={`${num(perf?.coverageMultiple ?? 0, 1)}×`} size={19} />
          <Stat
            label="Weighted mean payback"
            value={`${perf?.weightedMeanPaybackDays ?? 0} days`}
            size={19}
          />
        </Grid>
        <Note>
          Individual borrower revenue is not disclosed. Coverage is reported at portfolio level only.
        </Note>
      </Section>
    </Page>
  );
}
