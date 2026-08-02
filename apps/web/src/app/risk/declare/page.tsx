'use client';

import { applyLossWaterfall, usdc } from '@rivora/core';
import {
  Button,
  ButtonRow,
  Callout,
  CheckLine,
  DataTable,
  KeyValue,
  Page,
  PageHeader,
  Section,
  Stack,
} from '@rivora/ui';
import Link from 'next/link';

interface Trigger {
  label: string;
  measured: string;
  fired: boolean;
}

const TRIGGERS: Trigger[] = [
  { label: 'Coverage ratio below 0.50 for 14 days', measured: '0.31 · 16 d', fired: true },
  { label: 'Endpoint binding broken, uncured 7 days', measured: 'broken · 12 d', fired: true },
  { label: 'Interest coverage below 1.0 for 7 days', measured: '0.4 · 9 d', fired: true },
  { label: 'No routed revenue for 21 days', measured: '18 d', fired: false },
];

const OUTSTANDING = 4_200;
const ACCRUED = 38.1;

/**
 * S-56 — Default declaration. screens.md §10.7
 *
 * Default declaration is deliberately not discretionary. Automatic triggers
 * need no human; operator declaration needs quorum and published evidence.
 * Neither path lets a single operator default a borrower alone (PRD §19.8).
 */
export default function DeclareDefaultPage() {
  const { layers } = applyLossWaterfall(OUTSTANDING + ACCRUED, [
    { label: '1  Accrued borrower repayments in flight', available: 112.4 },
    { label: '2  Borrower loss reserve', available: 284 },
    { label: '3  Borrower security bond', available: 840 },
    { label: '4  Protocol first-loss tranche', available: 2_500 },
    { label: '5  Protocol loss reserve', available: 412.6 },
    { label: '6  Liquidity-provider loss (socialized)', available: Number.POSITIVE_INFINITY },
  ]);

  return (
    <Page measure="form">
      <PageHeader
        back={<Link href="/risk">← Overview</Link>}
        title="Declare default — borrower 0xaa71…0d3c"
        size={28}
      />

      <DataTable<Trigger>
        caption="Automatic triggers"
        rows={TRIGGERS}
        rowKey={(t) => t.label}
        style={{ marginBottom: 14 }}
        columns={[
          { key: 'label', header: 'Trigger', render: (t) => t.label },
          {
            key: 'measured',
            header: 'Measured',
            align: 'right',
            render: (t) => <span className="tabular">{t.measured}</span>,
          },
          {
            key: 'fired',
            header: 'State',
            render: (t) => (
              <span style={{ color: t.fired ? 'var(--color-danger)' : 'var(--color-neutral-600)' }}>
                {t.fired ? '✓ FIRED' : '○ not yet'}
              </span>
            ),
          },
        ]}
        footer={
          <span>
            ⓘ Three automatic triggers have fired. Default is declared by the contract and does not
            require operator action. This screen records the operator review and the evidence bundle.
          </span>
        }
      />

      <Section
        title={`Default waterfall preview — outstanding ${usdc(OUTSTANDING)} + ${usdc(ACCRUED)} interest`}
        style={{ marginBottom: 14 }}
      >
        <Stack gap={5} style={{ fontSize: 13, maxWidth: 560 }}>
          {layers.map((l) => (
            <KeyValue
              key={l.label}
              label={l.label}
              value={`${usdc(l.absorbed)} → ${usdc(l.remaining)}`}
            />
          ))}
          <KeyValue
            label="LP impact — share price"
            value="1.007597 → 1.004008 · −0.36%"
            divider
          />
        </Stack>
      </Section>

      <Section title="On declaration" style={{ marginBottom: 16 }}>
        <Stack gap={5} style={{ fontSize: 13 }}>
          <CheckLine mark="pass">Permanent record written to the public default registry</CheckLine>
          <CheckLine mark="pass">Cure path opened — record may be cured but never removed</CheckLine>
          <CheckLine mark="pass">
            Borrower notified with cure terms · reputation attestation updated
          </CheckLine>
        </Stack>
      </Section>

      <Callout severity="info">
        Signatures &nbsp;<span style={{ color: 'var(--color-ok)' }}>ops-a ✓</span> &nbsp;ops-b ○
        &nbsp;ops-c ○
      </Callout>

      <ButtonRow style={{ marginTop: 14 }}>
        <Link href="/risk">
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button variant="danger">Declare default</Button>
      </ButtonRow>
    </Page>
  );
}
