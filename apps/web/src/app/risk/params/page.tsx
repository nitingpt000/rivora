'use client';

import { RATE_MODEL, UNDERWRITING, VAULT, num, pct, usdc } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  ButtonRow,
  Callout,
  Card,
  DataTable,
  Grid,
  KeyValue,
  KeyValueList,
  Kicker,
  Note,
  Page,
  PageHeader,
  Stack,
  Tag,
} from '@rivora/ui';

interface Param {
  label: string;
  warning?: string;
  current: string;
  proposed: string;
  delay: string;
}

/** S-55 — Protocol parameters and emergency controls. screens.md §10.6 */
export default function ParamsPage() {
  const activeBorrowers = useProtocol((s) => s.activeBorrowers);

  // The blast radius, read rather than stated. An operator about to halt the
  // protocol should be told how many borrowers that actually stops.
  const emergency = [
    {
      label: 'Pause new draws',
      effect: `effect: ${activeBorrowers} ${activeBorrowers === 1 ? 'borrower' : 'borrowers'} cannot draw`,
    },
    { label: 'Pause deposits', effect: 'effect: vault closed to new liquidity' },
    { label: 'Pause lending entirely', effect: 'effect: draws + deposits + assessments halted' },
    { label: 'Emergency debt freeze', effect: 'effect: interest accrual stops protocol-wide' },
  ];

  const underwriting: Param[] = [
    {
      label: 'Base repayment share',
      warning: '⚠ recomputes all advance rates',
      current: '20%',
      proposed: '20',
      delay: '24h',
    },
    {
      label: 'Max horizon — Standard / Strong+',
      current: '45 d / 60 d',
      proposed: '45 / 60',
      delay: '24h',
    },
    { label: 'Q floor (Q_min)', current: num(UNDERWRITING.qMin, 2), proposed: '0.35', delay: '24h' },
    {
      label: 'Per-assessment growth cap',
      current: num(UNDERWRITING.growthCap, 2),
      proposed: '1.50',
      delay: '24h',
    },
    {
      label: 'New-borrower cap',
      current: usdc(UNDERWRITING.newBorrowerCap),
      proposed: '2500',
      delay: '24h',
    },
    {
      label: 'Revenue seasoning delay',
      current: `${UNDERWRITING.seasoningDays} d`,
      proposed: '3',
      delay: '24h',
    },
  ];

  return (
    <Page measure="narrow">
      <PageHeader
        title="Protocol parameters"
        aside={
          <Tag tone="outline" color="var(--color-warn)">
            ⚠ Quorum 2 of 3
          </Tag>
        }
      />

      <DataTable<Param>
        caption="Underwriting"
        rows={underwriting}
        rowKey={(p) => p.label}
        style={{ marginBottom: 14 }}
        columns={[
          {
            key: 'label',
            header: 'Parameter',
            render: (p) => (
              <>
                {p.label}
                {p.warning ? (
                  <div style={{ fontSize: 11.5, color: 'var(--color-warn)' }}>{p.warning}</div>
                ) : null}
              </>
            ),
          },
          {
            key: 'current',
            header: 'Current',
            align: 'right',
            render: (p) => <span className="tabular">{p.current}</span>,
          },
          {
            key: 'proposed',
            header: 'Proposed',
            align: 'right',
            render: (p) => (
              <span
                className="tabular"
                style={{ border: '1px solid var(--color-neutral-400)', padding: '2px 10px' }}
              >
                {p.proposed}
              </span>
            ),
          },
          { key: 'delay', header: 'Delay', align: 'right', render: (p) => p.delay },
        ]}
        footer={
          <span style={{ color: 'var(--color-warn)' }}>
            ⚠ The advance-rate table is derived from the repayment share and the horizon. Changing
            either without recomputing the tier table causes the horizon constraint to bind silently
            on every borrower.
          </span>
        }
      />

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="Rate model">
          <KeyValueList>
            <KeyValue label="Base rate r₀" value={pct(RATE_MODEL.base, 1)} />
            <KeyValue label="Kink U_k" value={pct(RATE_MODEL.kink * 100, 1)} />
            <KeyValue
              label="Low slope s₁ / high slope s₂"
              value={`${pct(RATE_MODEL.slopeLow, 1)} / ${pct(RATE_MODEL.slopeHigh, 1)}`}
            />
            <KeyValue label="Premiums P/S/Std/R" value="1 / 3 / 6 / 12%" />
          </KeyValueList>
        </Card>

        <Card kicker="Vault">
          <KeyValueList>
            <KeyValue label="Liquidity buffer floor" value={pct(VAULT.bufferFloorPct * 100, 1)} />
            <KeyValue label="Max utilization" value={pct(VAULT.maxUtilization * 100, 1)} />
            <KeyValue label="Withdrawal fee at 95%" value={pct(VAULT.feeMax * 100, 1)} />
            <KeyValue
              label="Bootstrap yield floor"
              value={`${pct(VAULT.bootstrapYieldFloorPct, 1)} · ends 2026-10-30`}
            />
          </KeyValueList>
          <Note style={{ marginTop: 8 }}>
            ⓘ Raising the buffer takes effect immediately; lowering it is subject to the 24h delay.
          </Note>
        </Card>
      </Grid>

      <Blueprint borderColor="var(--color-danger)" style={{ padding: '20px 26px', marginBottom: 14 }}>
        <Kicker style={{ marginBottom: 12, color: 'var(--color-danger)' }}>Emergency</Kicker>
        <Stack gap={8} style={{ fontSize: 13 }}>
          {emergency.map((e) => (
            <div
              key={e.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Button variant="danger" compact>
                {e.label}
              </Button>
              <span style={{ color: 'var(--color-neutral-700)' }}>{e.effect}</span>
            </div>
          ))}
        </Stack>
        <Note>
          All emergency actions require 2 of 3 operator signatures and publish a reason string
          onchain. Upgrades are subject to the governance delay.
        </Note>
      </Blueprint>

      <Callout severity="info">
        Signatures &nbsp;<span style={{ color: 'var(--color-ok)' }}>ops-a ✓ 14:32</span> &nbsp;ops-b ○
        pending &nbsp;ops-c ○ pending
      </Callout>

      <ButtonRow style={{ marginTop: 14 }}>
        <Button variant="ghost">Discard</Button>
        <Button variant="primary">Submit proposal</Button>
      </ButtonRow>
    </Page>
  );
}
