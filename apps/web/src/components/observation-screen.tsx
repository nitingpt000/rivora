'use client';

import { num, usdc } from '@rivora/core';
import { useProtocol, type ObservationRequirement } from '@rivora/protocol-sim';
import {
  Button,
  ButtonRow,
  Card,
  DataTable,
  Grid,
  Meter,
  Page,
  PageHeader,
  Sparkbars,
} from '@rivora/ui';
import Link from 'next/link';

import { Loading } from '@/components/loading';
import { day } from '@/lib/format';

/**
 * S-14 — Observation state. screens.md §7.5
 *
 * The first screen a new borrower sees and the one they will see for 30 days.
 * It has to make waiting feel like progress, so the requirements read as a
 * checklist with an indicative limit attached rather than an empty dashboard.
 */
export function ObservationScreen() {
  const observation = useProtocol((s) => s.observation);
  const assessment = useProtocol((s) => s.assessment);
  const registeredAt = useProtocol((s) => s.profile?.registeredAt);

  if (!observation) return <Loading label="Reading observation progress" />;

  const remaining = Math.max(0, observation.daysRequired - observation.daysObserved);

  return (
    <Page measure="form" paddingTop={36}>
      <PageHeader
        title="Building your credit profile"
        aside={
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 13,
              letterSpacing: '0.1em',
              color: 'var(--color-neutral-600)',
            }}
          >
            ○ OBSERVING
          </span>
        }
        lead="Rivora is observing your revenue. You cannot borrow yet."
      />

      <DataTable<ObservationRequirement>
        rows={observation.requirements}
        rowKey={(r) => r.label}
        style={{ marginBottom: 22 }}
        columns={[
          { key: 'label', header: 'Requirement', render: (r) => r.label },
          {
            key: 'progress',
            header: 'Progress',
            width: 280,
            render: (r) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Meter ratio={r.ratio} maxWidth={150} style={{ flex: 1 }} />
                <span className="tabular" style={{ fontSize: 12.5 }}>
                  {r.progress}
                </span>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            width: 90,
            render: (r) => (
              <span style={{ color: r.status === 'pass' ? 'var(--color-ok)' : 'var(--color-warn)' }}>
                {r.status === 'pass' ? '✓' : `⏱ ${remaining} d`}
              </span>
            ),
          },
        ]}
      />

      <Grid
        cols={2}
        style={{ marginBottom: 24, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)' }}
      >
        <Card kicker="Estimated first credit limit">
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 600 }}>
            {assessment ? `~${usdc(assessment.limit)} USDC` : '—'}
          </div>
          <p className="card-body">
            {/* Indicative because the ladder is evaluated against a partial
                window — the figure moves as the remaining days settle. */}
            Based on {observation.daysObserved} days of data, extrapolated. Indicative only — the
            first binding assessment runs once {observation.daysRequired} days have settled.
          </p>
        </Card>

        <Card kicker="Revenue observed so far">
          {observation.dailySeries.length ? (
            <Sparkbars
              bars={observation.dailySeries.map((value) => ({ value }))}
              height={110}
              axis={{ left: day(registeredAt), right: `${num(observation.daysObserved, 0)} d` }}
            />
          ) : (
            <p className="card-body">No settled revenue observed yet.</p>
          )}
        </Card>
      </Grid>

      <ButtonRow align="between">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/credit">
            <Button variant="secondary">See what would raise my limit</Button>
          </Link>
          <Link href="/revenue">
            <Button variant="ghost">Revenue detail</Button>
          </Link>
        </div>
        <Link href="/custody">
          <Button variant="ghost">Check routing</Button>
        </Link>
      </ButtonRow>
    </Page>
  );
}
