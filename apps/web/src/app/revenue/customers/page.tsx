'use client';

import { CONCENTRATION_CEILINGS, FACTOR_WEIGHTS, num, pct, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import { KeyValue, Meter, Mono, Note, Page, PageHeader, Section, Stack, Tag } from '@rivora/ui';
import Link from 'next/link';

import { Loading } from '@/components/loading';
import { day } from '@/lib/format';

/** S-23 — Customer concentration. screens.md §8.4 */
export default function CustomersPage() {
  const s = useProtocol();
  const d = useDerived();
  const customers = s.customers;
  const upstream = s.custody?.upstream ?? [];

  if (!customers) return <Loading label="Reading customer concentration" />;

  const concentrationPenalty = (1 - s.factors.C) * FACTOR_WEIGHTS.C * 100;

  // Only the payers big enough to matter are listed; the rest are summarised
  // as one row rather than paginated, since the point of the screen is the
  // shape of the distribution.
  const top = customers.slice(0, 8);
  const otherShare = Math.max(0, 100 - top.reduce((a, p) => a + p.sharePct, 0));
  const largestShare = top[0]?.sharePct ?? 0;

  return (
    <Page measure="mid">
      <PageHeader back={<Link href="/revenue">← Revenue</Link>} title="Customer concentration" />

      <div
        style={{
          display: 'flex',
          gap: 28,
          fontSize: 14,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span>
          HHI <strong>{num(s.hhi, 2)}</strong>
        </span>
        <span>
          Band <Tag tone="accent">{d.concentrationBand}</Tag>
        </span>
        <span>
          Factor C <strong>{num(s.factors.C, 2)}</strong>
        </span>
        <span style={{ color: 'var(--color-neutral-600)' }}>
          penalty {num(concentrationPenalty, 2)} pts
        </span>
      </div>

      <Section
        title={`Concentration ceilings — largest payer ${pct(s.largestPayerPct, 0)}`}
        style={{ marginBottom: 16 }}
      >
        <Meter
          ratio={s.largestPayerPct / 100}
          height={14}
          markers={CONCENTRATION_CEILINGS.map((c) => ({ at: c.threshold, label: c.effect }))}
        />
        <div
          className="riv-grid riv-grid-3"
          style={{
            gap: 8,
            fontSize: 11.5,
            color: 'var(--color-neutral-600)',
            marginTop: 10,
          }}
        >
          {CONCENTRATION_CEILINGS.map((c) => (
            <span key={c.threshold}>
              {pct(c.threshold * 100, 0)} — {c.effect}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Top payers" style={{ marginBottom: 16 }}>
        <Stack gap={8}>
          {top.map((p) => (
            <div
              key={p.label}
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(80px, 90px) minmax(0, 1fr) 60px minmax(90px, 130px) 110px 60px',
                alignItems: 'center',
                gap: 12,
                fontSize: 13,
              }}
            >
              <Mono>{p.label}</Mono>
              {/* Scaled to the largest payer, so the bars fill the row and the
                  gap between first and second is readable at a glance. */}
              <Meter
                ratio={largestShare > 0 ? p.sharePct / largestShare : 0}
                height={10}
                maxWidth={260}
              />
              <span className="tabular">{pct(p.sharePct, 1)}</span>
              <span className="tabular" style={{ textAlign: 'right' }}>
                {usdc(p.revenue30d)}
              </span>
              <span
                style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'right' }}
              >
                {num(p.requests30d, 0)} payments
              </span>
              <span
                style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'right' }}
              >
                since {day(p.firstSeenAt)}
              </span>
            </div>
          ))}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(80px, 90px) minmax(0, 1fr) 60px',
              alignItems: 'center',
              gap: 12,
              fontSize: 13,
            }}
          >
            <Mono>{Math.max(0, s.uniquePayers - top.length)} others</Mono>
            <Meter ratio={otherShare / 100} height={10} maxWidth={260} />
            <span className="tabular">{pct(otherShare, 1)}</span>
          </div>
        </Stack>
        <Note>
          Payer labels are stable pseudonyms. Wallet addresses are available in the CSV export and
          are never displayed onchain or to liquidity providers.
        </Note>
      </Section>

      <Section
        title="Upstream concentration"
        aside={
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>ⓘ declared</span>
        }
      >
        <Stack gap={6} style={{ fontSize: 13, maxWidth: 460 }}>
          {upstream.length === 0 ? (
            <span style={{ color: 'var(--color-neutral-600)' }}>None declared.</span>
          ) : null}
          {upstream.filter((u) => u.declaredCostPct > 0).map((u) => (
            <KeyValue
              key={u.name}
              label={u.name}
              value={`${pct(u.declaredCostPct, 0)} of declared cost base`}
            />
          ))}
        </Stack>
        <Note>
          Recorded for reporting. Applied as a portfolio-level haircut in production, not a
          per-borrower one — a shock at one provider impairs many borrowers at once, which
          diversifying across borrowers does not fix.
        </Note>
      </Section>
    </Page>
  );
}
