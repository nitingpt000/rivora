'use client';

import { RECOVERY_REPAYMENT_BPS, pct, usdc } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import {
  Button,
  Callout,
  ButtonRow,
  Card,
  CheckLine,
  Grid,
  KeyValue,
  KeyValueList,
  Meter,
  Page,
  PageHeader,
  Section,
  Stack,
  Stat,
} from '@rivora/ui';

import { Loading } from '@/components/loading';

/**
 * S-33 — Recovery and cure. screens.md §8.14
 *
 * Default does not permanently terminate a service. A borrower that keeps
 * earning is worth more to the protocol repaying slowly than written off, and
 * the cure record stays visible with its cure date rather than being erased
 * (PRD §19.5).
 */
export default function RecoveryPage() {
  const registry = useProtocol((s) => s.defaults);
  const handle = useProtocol((s) => s.profile?.handle);
  const status = useProtocol((s) => s.status);
  const principal = useProtocol((s) => s.principal);
  const accruedInterest = useProtocol((s) => s.accruedInterest);
  const dailyRevenue = useProtocol((s) => s.dailyRevenue);

  if (!registry) return <Loading label="Reading the default registry" />;

  /**
   * This borrower's own record, from the public registry.
   *
   * The registry is the source: a cure is measured against what was actually
   * declared, and the declared principal is the only figure that can be.
   */
  const record = registry.records.find((r) => r.borrower === handle) ?? null;

  if (!record) {
    return (
      <Page measure="form">
        <PageHeader title="Cure" />
        <Callout severity="info">
          No default has been recorded against this service. This page opens if one ever is —
          a record may be cured, but it is never removed.
        </Callout>
      </Page>
    );
  }

  const outstandingAtDefault = record.principal;
  const recovered = record.recovered;
  const remaining = Math.max(0, outstandingAtDefault - recovered);
  const recoveryRatio = outstandingAtDefault > 0 ? recovered / outstandingAtDefault : 0;

  // What the recovery share actually collects per day at current revenue.
  const perDay = (dailyRevenue * RECOVERY_REPAYMENT_BPS) / 10_000;
  const daysLeft = perDay > 0 ? Math.ceil(remaining / perDay) : null;

  return (
    <Page measure="form">
      <PageHeader
        title="Cure"
        aside={
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 13,
              letterSpacing: '0.1em',
              color: 'var(--color-danger)',
            }}
          >
            {record.curedAt ? '✓ CURED' : '⛔ DEFAULTED'} — {record.borrower}
          </span>
        }
      />

      <Section style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
          <Stat label="Outstanding at default" value={`${usdc(outstandingAtDefault)} USDC`} size={26} />
          <Stat label="Recovered" value={`${usdc(recovered)} USDC`} size={26} />
          <Stat label="Remaining" value={`${usdc(remaining)} USDC`} size={26} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
              Recovery {pct(recoveryRatio * 100, 1)}
            </div>
            <Meter ratio={recoveryRatio} height={10} style={{ marginTop: 8 }} />
          </div>
        </div>
      </Section>

      <Section title="Cure progress" style={{ marginBottom: 14 }}>
        <Stack gap={8} style={{ fontSize: 13.5 }}>
          <CheckLine mark={status === 'DEFAULTED' ? 'pending' : 'pass'}>
            1 &nbsp;Re-bind a Revenue Router
          </CheckLine>
          <CheckLine mark="pass">
            2 &nbsp;Accept the recovery repayment share — {pct(RECOVERY_REPAYMENT_BPS / 100, 0)}
          </CheckLine>
          <CheckLine mark={remaining > 0 ? 'pending' : 'pass'}>
            3 &nbsp;Repay remaining principal and interest — {usdc(remaining)} remaining
            {perDay > 0 ? ` · ~${usdc(perDay)}/day at current revenue` : ''}
            {daysLeft !== null && remaining > 0 ? ` · ~${daysLeft} days` : ''}
          </CheckLine>
          <CheckLine mark={record.curedAt ? 'pass' : 'todo'}>
            4 &nbsp;30 days of continued routed revenue after full repayment
            {record.curedAt ? ` · cured in ${record.daysToCure} days` : ''}
          </CheckLine>
        </Stack>
      </Section>

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="During cure">
          <KeyValueList>
            <KeyValue label="Outstanding now" value={`${usdc(principal + accruedInterest)} USDC`} />
            <KeyValue
              label="Repayment share"
              value={`${pct(RECOVERY_REPAYMENT_BPS / 100, 0)} (recovery rate)`}
            />
            <KeyValue label="Reserve share" value="0% — applied to debt instead" />
            <KeyValue label="Reliability probes" value="continuing" />
            <KeyValue label="Progress visibility" value="public — /reputation" />
          </KeyValueList>
        </Card>

        <Card kicker="After cure">
          <KeyValueList>
            <KeyValue label="Re-entry tier" value="Restricted" />
            <KeyValue label="Advance rate" value="50% of tier base for 180 days" />
            <KeyValue label="Default record" value="remains visible with curedAt set" />
          </KeyValueList>
        </Card>
      </Grid>

      <ButtonRow>
        <Button variant="ghost">Propose a settlement</Button>
        <Button variant="primary" disabled={remaining <= 0}>
          Repay {usdc(remaining)} now
        </Button>
      </ButtonRow>
    </Page>
  );
}
