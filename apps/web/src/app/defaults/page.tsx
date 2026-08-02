'use client';

import { usdc } from '@rivora/core';
import { useProtocol, type DefaultRecordEntry } from '@rivora/protocol-sim';
import { DataTable, Mono, Note, Page, PageHeader, Tag } from '@rivora/ui';

import { Loading } from '@/components/loading';
import { day } from '@/lib/format';

/**
 * S-04 — Default registry. screens.md §6.4
 *
 * There is deliberately no interface path to delete a record. The registry's
 * value to a third party depends entirely on it being non-negotiable — a
 * registry the operator can be persuaded to clear is worth nothing (PRD §19.4).
 */
export default function DefaultsPage() {
  const registry = useProtocol((s) => s.defaults);

  if (!registry) return <Loading label="Reading the default registry" />;

  return (
    <Page measure="mid" paddingTop={36}>
      <PageHeader
        title="Default registry"
        lead="Records are permanent. A default may be cured but is never removed."
      />

      <DataTable<DefaultRecordEntry>
        rows={registry.records}
        rowKey={(r) => `${r.borrower}-${r.declaredAt}`}
        detail={(r) =>
          `evidence ${r.evidenceHash} · ${r.automatic ? 'declared automatically' : 'declared by an operator'}`
        }
        empty="No default has been recorded."
        columns={[
          { key: 'id', header: 'Borrower', render: (r) => <Mono size={12.5}>{r.borrower}</Mono> },
          {
            key: 'defaulted',
            header: 'Defaulted',
            render: (r) => (
              <>
                {day(r.declaredAt)}
                <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                  {r.curedAt ? `cured in ${r.daysToCure} days` : 'uncured'}
                </div>
              </>
            ),
          },
          {
            key: 'principal',
            header: 'Principal',
            align: 'right',
            render: (r) => <span className="tabular">{usdc(r.principal)}</span>,
          },
          {
            key: 'recovered',
            header: 'Recovered',
            align: 'right',
            render: (r) => <span className="tabular">{usdc(r.recovered)}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) =>
              r.curedAt ? (
                <Tag tone="accent">✓ CURED</Tag>
              ) : (
                <Tag tone="outline" color="var(--color-warn)">
                  ⚠ UNCURED
                </Tag>
              ),
          },
          {
            key: 'trigger',
            header: 'Trigger',
            render: (r) => <span style={{ fontSize: 12.5 }}>{r.trigger}</span>,
          },
        ]}
        footer={
          <>
            <span>{registry.count} records</span>
            <span>{usdc(registry.totalPrincipal)} principal</span>
            <span>{usdc(registry.totalRecovered)} recovered</span>
            <span>Recovery rate {registry.recoveryRatePct.toFixed(1)}%</span>
            <span>Cure rate {registry.cureRatePct.toFixed(1)}%</span>
          </>
        }
      />

      <Note>
        There is no interface path to delete a record. The registry&rsquo;s value to third parties
        depends on it being non-negotiable.
      </Note>
    </Page>
  );
}
