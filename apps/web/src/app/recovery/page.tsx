'use client';

import { RECOVERY_REPAYMENT_BPS, pct, usdc } from '@rivora/core';
import {
  Button,
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

const OUTSTANDING_AT_DEFAULT = 2_000;
const RECOVERED = 640;

/**
 * S-33 — Recovery and cure. screens.md §8.14
 *
 * Default does not permanently terminate a service. A borrower that keeps
 * earning is worth more to the protocol repaying slowly than written off, and
 * the cure record stays visible with its cure date rather than being erased
 * (PRD §19.5).
 */
export default function RecoveryPage() {
  const remaining = OUTSTANDING_AT_DEFAULT - RECOVERED;
  const recoveryRatio = RECOVERED / OUTSTANDING_AT_DEFAULT;

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
            ⛔ DEFAULTED — example record 0xaa71…0d3c
          </span>
        }
      />

      <Section style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
          <Stat label="Outstanding at default" value={`${usdc(OUTSTANDING_AT_DEFAULT)} USDC`} size={26} />
          <Stat label="Recovered" value={`${usdc(RECOVERED)} USDC`} size={26} />
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
          <CheckLine mark="pass">
            1 &nbsp;Re-bind a Revenue Router — 0x7f3a…c1d2 verified Aug 26
          </CheckLine>
          <CheckLine mark="pass">
            2 &nbsp;Accept the recovery repayment share — {pct(RECOVERY_REPAYMENT_BPS / 100, 0)}
          </CheckLine>
          <CheckLine mark="pending">
            3 &nbsp;Repay remaining principal and interest — {usdc(remaining)} remaining · ~112.50/day
            at current revenue · ~12 days
          </CheckLine>
          <CheckLine mark="todo">
            4 &nbsp;30 days of continued routed revenue after full repayment
          </CheckLine>
        </Stack>
      </Section>

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="During cure">
          <KeyValueList>
            <KeyValue label="Credit limit" value="0.00 USDC" />
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
        <Button variant="primary">Repay {usdc(remaining)} now</Button>
      </ButtonRow>
    </Page>
  );
}
