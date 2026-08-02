'use client';

import { days, num, pct, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  Button,
  ButtonRow,
  Card,
  CheckLine,
  Delta,
  Grid,
  Meter,
  Money,
  Mono,
  Page,
  Section,
  Stack,
  StatusPill,
  StepChart,
} from '@rivora/ui';
import Link from 'next/link';

import { BorrowerBanner } from '@/components/borrower-banner';
import { ObservationScreen } from '@/components/observation-screen';

/** S-20 — Borrower dashboard. screens.md §8.1 */
export default function DashboardPage() {
  const s = useProtocol();
  const d = useDerived();

  // A freshly registered service has no history yet and sees S-14 instead.
  if (s.serviceView === 'new') return <ObservationScreen />;

  const repaymentShare = s.repaymentBps / 10_000;
  const reserveShare = s.reserveBps / 10_000;
  const operatingShare = 1 - repaymentShare - reserveShare;

  const health = [
    { label: 'Uptime probe', value: pct(s.uptimePct, 1), pass: s.uptimePct >= 99 },
    { label: 'Settlement success', value: pct(s.successPct, 1), pass: s.successPct >= 90 },
    { label: 'Median latency', value: `${s.latencyMs}ms`, pass: s.latencyMs < 500 },
    { label: 'Refund rate', value: pct(s.refundRatePct, 1), pass: s.refundRatePct < 2 },
    { label: 'Binding probe', value: s.bindingOk ? '2m ago' : 'MISMATCH', pass: s.bindingOk },
    { label: 'Coverage ratio', value: num(s.coverageRatio, 2), pass: s.coverageRatio >= 0.95 },
    {
      label: 'Interest coverage',
      value: Number.isFinite(d.interestCoverage) ? num(d.interestCoverage, 1) : '—',
      pass: d.interestCoverage >= 3,
    },
  ];

  return (
    <Page measure="wide" paddingTop={24}>
      <BorrowerBanner />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, margin: 0 }}>
          {s.profile?.serviceName ?? '—'}
        </h1>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          Custody {s.profile?.custody ?? '—'}{' '}
          <span style={{ color: s.bindingOk ? 'var(--color-ok)' : 'var(--color-danger)' }}>
            {s.bindingOk ? '✓' : '✕'}
          </span>{' '}
          · Coverage {num(s.coverageRatio, 2)}
        </span>
      </div>

      <Grid cols={3} style={{ marginBottom: 14 }}>
        <Card kicker="Available credit">
          <Money value={d.available} size="xl" />
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            of {usdc(s.limit)} limit
          </div>
          <Meter ratio={d.drawnRatio} style={{ marginTop: 8 }} />
          <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 3 }}>
            {pct(d.drawnRatio * 100, 1)} drawn
          </div>
        </Card>

        <Card kicker="Outstanding debt">
          <Money value={d.owed} size="xl" />
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            principal {usdc(s.principal)} · interest {usdc(s.accruedInterest)}
          </div>
        </Card>

        <Card kicker="Risk score">
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600 }}>
            {s.score} <Delta value={d.scoreDelta} style={{ fontSize: 15 }} />
          </div>
          <StatusPill status={s.status} tier={s.tier} score={s.score} size={12.5} />
          <Meter ratio={s.score / 100} style={{ marginTop: 8 }} />
        </Card>
      </Grid>

      <Grid cols={3} style={{ marginBottom: 18 }}>
        <Card kicker="Interest rate">
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>
            {pct(d.borrowerRatePct)} <span style={{ fontSize: 13, fontWeight: 400 }}>APR</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            r(U) {pct(d.baseRatePct)} + {pct(d.premiumPct, 0)} {s.tier} premium
          </div>
        </Card>

        <Card kicker="30-day eligible revenue">
          <div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>
            {usdc(s.eligibleRevenue)}{' '}
            <span style={{ fontSize: 13, fontWeight: 400 }}>
              USDC <Delta value={s.growthPct} suffix="%" />
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            gross {usdc(s.grossRevenue)} · excluded {usdc(s.excludedRevenue)}
          </div>
        </Card>

        <Card kicker="Next repayment">
          <div className="tabular" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600 }}>
            ~{usdc(d.dailyRepayment)} <span style={{ fontSize: 13, fontWeight: 400 }}>USDC</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            at next settlement · ⏱ in ~3h 20m
          </div>
        </Card>
      </Grid>

      <Section
        title="Revenue allocation — every 100 USDC that settles"
        style={{ marginBottom: 18 }}
      >
        <Stack gap={8} style={{ fontSize: 13.5 }}>
          {[
            {
              label: `Repayment ${pct(repaymentShare * 100, 0)}`,
              ratio: repaymentShare,
              fill: 'var(--color-accent)',
              dest: 'Credit Vault',
            },
            {
              label: `Reserve ${pct(reserveShare * 100, 0)}`,
              ratio: reserveShare,
              fill: 'var(--color-accent-300)',
              dest: 'Loss reserve',
            },
            {
              label: `Operating ${pct(operatingShare * 100, 0)}`,
              ratio: operatingShare,
              fill: 'var(--color-neutral-300)',
              dest: s.profile?.operatingWallet ?? 'Operating wallet',
            },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(110px, 130px) minmax(0, 1fr) minmax(180px, 220px)',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <span>{row.label}</span>
              <Meter ratio={row.ratio} height={12} fill={row.fill} />
              <span className="tabular" style={{ color: 'var(--color-neutral-700)' }}>
                {usdc(row.ratio * 100)} USDC → {row.dest}
              </span>
            </div>
          ))}
        </Stack>
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)', marginTop: 12 }}>
          At {usdc(s.dailyRevenue)} USDC/day you repay ~{usdc(d.dailyRepayment)}/day. Projected
          payback {days(d.paybackDays)}.
        </div>
      </Section>

      <Section
        title="Credit limit history"
        aside={<Link href="/credit/history">Full history →</Link>}
        style={{ marginBottom: 18 }}
      >
        <StepChart
          steps={[
            { widthPct: 22, heightPct: 0, axis: 'Jun 03' },
            { widthPct: 39, heightPct: 56, label: '1,690', axis: '▲ assessment 1' },
            {
              widthPct: 39,
              heightPct: s.limit > 0 ? 84 : 4,
              label: usdc(s.limit),
              axis: '▲ assessment 2',
            },
          ]}
        />
      </Section>

      <Grid cols={2} style={{ marginBottom: 20 }}>
        <Card kicker="Service health" aside={<Link href="/custody">Custody detail →</Link>}>
          <Stack gap={6} style={{ fontSize: 13, marginTop: 8 }}>
            {health.map((h) => (
              <CheckLine key={h.label} mark={h.pass ? 'pass' : 'warn'} value={h.value}>
                {h.label}
              </CheckLine>
            ))}
          </Stack>
        </Card>

        <Card kicker="Risk warnings">
          <Stack gap={12} style={{ fontSize: 13, marginTop: 8 }}>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.04em',
                  color: 'var(--color-warn)',
                }}
              >
                ⚠ Concentration {d.concentrationBand}
              </div>
              <div style={{ color: 'var(--color-neutral-700)', marginTop: 2 }}>
                Largest payer {pct(s.largestPayerPct, 0)} of revenue. Above 40% your limit is capped
                at the new-borrower cap.
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.04em',
                  color: 'var(--color-neutral-700)',
                }}
              >
                ⓘ Costs unverified
              </div>
              <div style={{ color: 'var(--color-neutral-700)', marginTop: 2 }}>
                M is capped at 0.95. Route upstream spend through Rivora-observable rails to lift the
                ceiling.
              </div>
            </div>
          </Stack>
        </Card>
      </Grid>

      <ButtonRow align="center">
        {d.canBorrow ? (
          <Button variant="primary" onClick={() => s.openModal('draw')}>
            Borrow USDC
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            Borrow disabled
          </Button>
        )}
        {d.hasDebt ? (
          <Button variant="secondary" onClick={() => s.openModal('repay')}>
            Repay manually
          </Button>
        ) : null}
        <Link href="/credit/assessment">
          <Button variant="ghost">Why this limit?</Button>
        </Link>
      </ButtonRow>

      <div
        style={{
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
          marginTop: 16,
          fontSize: 12,
          flexWrap: 'wrap',
        }}
      >
        <Link href="/recovery">Recovery &amp; cure</Link>
        <Link href="/close-account">Close account</Link>
        <span style={{ color: 'var(--color-neutral-600)' }}>
          Operating wallet <Mono>{s.profile?.operatingWallet ?? '—'}</Mono>
        </span>
      </div>
    </Page>
  );
}
