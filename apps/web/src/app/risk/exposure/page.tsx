'use client';

import { UNDERWRITING, VAULT, pct, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  BarRow,
  Button,
  ButtonRow,
  Callout,
  DataTable,
  KeyValue,
  Page,
  PageHeader,
  Section,
  Stack,
  Tag,
} from '@rivora/ui';
import Link from 'next/link';

interface Limit {
  label: string;
  note?: string;
  current: string;
  cap: string;
  headroom: string;
  status: 'ok' | 'warn' | 'breached';
}

const STATUS = {
  ok: { glyph: '✓', color: 'var(--color-ok)' },
  warn: { glyph: '⚠', color: 'var(--color-warn)' },
  breached: { glyph: '⛔ breached', color: 'var(--color-danger)' },
};

/** S-54 — Exposure and concentration. screens.md §10.5 */
export default function ExposurePage() {
  const s = useProtocol();
  const exposure = s.exposure;

  // Read from the same report the tables render, so the prose cannot
  // contradict the figures directly above it.
  const topSector = exposure?.bySector[0] ?? null;
  const breachedSector = exposure?.bySector.find((sector) => sector.breached) ?? null;
  const topUpstream = exposure?.upstream[0] ?? null;
  const d = useDerived();

  const limits: Limit[] = [
    {
      label: 'Vault utilization',
      current: pct(d.utilization * 100),
      cap: pct(VAULT.maxUtilization * 100),
      headroom: `${pct((VAULT.maxUtilization - d.utilization) * 100)}pp`,
      status: d.utilization <= VAULT.maxUtilization ? 'ok' : 'breached',
    },
    {
      label: 'Liquidity buffer',
      current: pct(d.bufferPct),
      cap: `${pct(VAULT.bufferFloorPct * 100)} floor`,
      headroom: `${pct(d.bufferPct - VAULT.bufferFloorPct * 100)}pp`,
      status: d.bufferPct >= VAULT.bufferFloorPct * 100 ? 'ok' : 'breached',
    },
    {
      label: 'Per-borrower exposure',
      ...(exposure && exposure.breaches > 0
        ? { note: `${exposure.breaches} over cap — limits frozen` }
        : {}),
      current: pct(exposure?.largestExposurePct ?? 0),
      cap: pct(UNDERWRITING.exposureCapPct * 100),
      headroom: `${pct(UNDERWRITING.exposureCapPct * 100 - (exposure?.largestExposurePct ?? 0))}pp`,
      status: (exposure?.breaches ?? 0) > 0 ? 'breached' : 'ok',
    },
    {
      label: 'Per-sector exposure',
      ...(breachedSector ? { note: `${breachedSector.sector} — new draws in sector blocked` } : {}),
      current: pct(topSector?.sharePct ?? 0),
      cap: pct(exposure?.sectorCapPct ?? 0),
      headroom: `${pct((exposure?.sectorCapPct ?? 0) - (topSector?.sharePct ?? 0))}pp`,
      status: breachedSector ? 'breached' : 'ok',
    },
    {
      label: 'Customer-concentration cap',
      current: pct(s.largestPayerPct),
      cap: '40.00%',
      headroom: `${pct(40 - s.largestPayerPct)}pp`,
      status: s.largestPayerPct <= 40 ? 'ok' : 'warn',
    },
    {
      label: 'New-borrower aggregate',
      current: '0.00%',
      cap: '20.00%',
      headroom: '20.00pp',
      status: 'ok',
    },
    {
      label: 'Credit-growth cap, 30d',
      current: '18.20%',
      cap: '50.00%',
      headroom: '31.80pp',
      status: 'ok',
    },
    {
      label: 'Withdrawal-queue depth',
      current: pct(s.vaultAssets > 0 ? (s.queueTotal / s.vaultAssets) * 100 : 0),
      cap: '20.00%',
      headroom: '—',
      status: 'ok',
    },
    {
      label: 'Minimum reserve coverage',
      current: '4.90%',
      cap: '3.00% floor',
      headroom: '1.90pp',
      status: 'ok',
    },
    {
      label: 'Realized losses, 30d',
      current: '0.00%',
      cap: '2.00%',
      headroom: '2.00pp',
      status: 'ok',
    },
  ];

  return (
    <Page measure="mid">
      <PageHeader title="Exposure and concentration" />

      <DataTable<Limit>
        rows={limits}
        rowKey={(l) => l.label}
        style={{ marginBottom: 14 }}
        columns={[
          {
            key: 'label',
            header: 'Limit',
            render: (l) => (
              <>
                {l.label}
                {l.note ? (
                  <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
                    └ {l.note}
                  </div>
                ) : null}
              </>
            ),
          },
          {
            key: 'current',
            header: 'Current',
            align: 'right',
            render: (l) => <span className="tabular">{l.current}</span>,
          },
          {
            key: 'cap',
            header: 'Cap',
            align: 'right',
            render: (l) => <span className="tabular">{l.cap}</span>,
          },
          {
            key: 'headroom',
            header: 'Headroom',
            align: 'right',
            render: (l) => <span className="tabular">{l.headroom}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (l) => (
              <span style={{ color: STATUS[l.status].color }}>{STATUS[l.status].glyph}</span>
            ),
          },
        ]}
      />

      <Section title="Upstream correlated exposure" style={{ marginBottom: 14 }}>
        <Stack gap={7}>
          {(s.exposure?.upstream ?? []).map((u) => (
            <BarRow
              key={u.name}
              label={u.name}
              value={usdc(u.principal)}
              ratio={u.sharePct / 100}
              trailing={
                <>
                  {pct(u.sharePct, 1)} {u.sharePct > 40 ? '⚠ >40%' : ''}
                </>
              }
              labelWidth={180}
              valueWidth={90}
              barMaxWidth={280}
            />
          ))}
        </Stack>
        {topUpstream ? (
          <Callout severity="warn">
            A price or availability shock at {topUpstream.name} impairs{' '}
            {pct(topUpstream.sharePct, 1)} of the book simultaneously. Borrower diversification does
            not reduce this. Consider a portfolio-level haircut or a sector draw freeze.
          </Callout>
        ) : null}
      </Section>

      <Section
        title="Stress test"
        aside={<Tag tone="neutral">Scenario · −30% revenue, all borrowers</Tag>}
        style={{ marginBottom: 16 }}
      >
        <Stack gap={6} style={{ fontSize: 13, maxWidth: 620 }}>
          <KeyValue
            label="Weighted payback"
            value={
              <>
                26 d → 37 d <span style={{ color: 'var(--color-ok)' }}>✓ within 90-day limit</span>
              </>
            }
          />
          <KeyValue
            label="Borrowers below coverage 1.0"
            value={
              <>
                0 → 0 <span style={{ color: 'var(--color-ok)' }}>✓</span>
              </>
            }
          />
          <KeyValue
            label="Borrowers moved to WATCH"
            value={
              <>
                {s.onWatch} → 4 <span style={{ color: 'var(--color-warn)' }}>⚠</span>
              </>
            }
          />
          <KeyValue
            label="Projected 90-day losses"
            value={
              <>
                0.00 → 180.40{' '}
                <span style={{ color: 'var(--color-ok)' }}>✓ absorbed by first loss</span>
              </>
            }
          />
          <KeyValue
            label="Queue clearance time"
            value={
              <>
                0 d → 12 d <span style={{ color: 'var(--color-ok)' }}>✓</span>
              </>
            }
          />
        </Stack>
      </Section>

      <ButtonRow align="start">
        <Button variant="secondary" compact>
          Freeze sector draws
        </Button>
        <Link href="/risk/params">
          <Button variant="ghost" compact>
            Adjust caps
          </Button>
        </Link>
        <Button variant="ghost" compact>
          Export stress report
        </Button>
      </ButtonRow>
    </Page>
  );
}
