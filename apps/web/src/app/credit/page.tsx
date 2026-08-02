'use client';

import {
  COVERAGE,
  TIER_MAX_HORIZON_DAYS,
  VAULT,
  days,
  num,
  pct,
  usdc,
} from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
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
  StatusPill,
} from '@rivora/ui';
import Link from 'next/link';

import { BorrowerBanner } from '@/components/borrower-banner';

/** S-24 — Credit. screens.md §8.5 */
export default function CreditPage() {
  const s = useProtocol();
  const d = useDerived();

  const capacityChecks = [
    {
      label: 'Interest coverage',
      detail: `required ≥ ${COVERAGE.minInterestCoverageForDraw.toFixed(1)}`,
      value: Number.isFinite(d.interestCoverage) ? num(d.interestCoverage, 1) : '—',
      pass: d.interestCoverage >= COVERAGE.minInterestCoverageForDraw,
    },
    {
      label: 'Projected payback',
      detail: `max ${TIER_MAX_HORIZON_DAYS[s.tier]} days (${s.tier})`,
      value: days(d.paybackDays),
      pass: (d.paybackDays ?? 0) <= TIER_MAX_HORIZON_DAYS[s.tier],
    },
    {
      label: 'Stressed payback',
      detail: 'max 90 days at −30% revenue',
      value: days(d.stressedPaybackDays),
      pass: (d.stressedPaybackDays ?? 0) <= 90,
    },
    {
      label: 'Vault buffer',
      detail: `floor ${pct(VAULT.bufferFloorPct * 100, 0)}`,
      value: pct(d.bufferPct, 1),
      pass: d.bufferPct >= VAULT.bufferFloorPct * 100,
    },
    {
      label: 'Coverage ratio',
      detail: `diversion threshold ${num(COVERAGE.routedDiversion, 2)}`,
      value: num(s.coverageRatio, 2),
      pass: s.coverageRatio >= COVERAGE.routedReview,
    },
  ];

  return (
    <Page measure="mid">
      <BorrowerBanner />
      <PageHeader
        title="Credit"
        aside={<StatusPill status={s.status} tier={s.tier} score={s.score} />}
      />

      <Blueprint style={{ padding: '24px 30px', marginBottom: 16 }}>
        <Stack gap={6} style={{ fontSize: 14.5, maxWidth: 520 }}>
          <KeyValue label="Approved credit limit" value={`${usdc(s.limit)} USDC`} />
          <KeyValue label="Outstanding principal" value={`− ${usdc(s.principal)} USDC`} />
          <KeyValue label="Pending draw requests" value={`− ${usdc(s.pendingDraws)} USDC`} />
          <KeyValue label="Available credit" value={`${usdc(d.available)} USDC`} strong divider />
          <KeyValue
            label="Accrued interest"
            value={`${usdc(s.accruedInterest)} USDC`}
            style={{ marginTop: 8 }}
          />
          <KeyValue label="Total owed" value={`${usdc(d.owed)} USDC`} strong />
        </Stack>
        <Meter ratio={d.drawnRatio} height={12} style={{ marginTop: 16 }} />
        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 4 }}>
          {pct(d.drawnRatio * 100, 1)} drawn
        </div>
      </Blueprint>

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="Terms">
          <KeyValueList>
            <KeyValue label="Borrower tier" value={s.tier} />
            <KeyValue label="Risk premium" value={pct(d.premiumPct, 0)} />
            <KeyValue label="Vault base rate" value={pct(d.baseRatePct)} />
            <KeyValue label="Your rate" value={<strong>{pct(d.borrowerRatePct)} APR</strong>} />
            <KeyValue label="Repayment share" value={pct(s.repaymentBps / 100, 0)} />
            <KeyValue label="Reserve share" value={pct(s.reserveBps / 100, 0)} />
            <KeyValue
              label="Reserve balance"
              value={`${usdc(s.reserve)} / ${usdc(s.reserveTarget)}`}
            />
          </KeyValueList>
        </Card>

        <Card kicker="Capacity checks">
          <Stack gap={8} style={{ fontSize: 13, marginTop: 8 }}>
            {capacityChecks.map((c) => (
              <CheckLine
                key={c.label}
                mark={c.pass ? 'pass' : 'warn'}
                value={c.value}
                detail={c.detail}
              >
                {c.label}
              </CheckLine>
            ))}
          </Stack>
        </Card>
      </Grid>

      {/*
        The constraint ladder is the most load-bearing block in the product.
        PRD §14.5: a borrower told only the final number will try to improve
        metrics that are not the constraint. Showing every candidate limit and
        marking the binding one converts a black box into an instruction.
      */}
      <Section title={`Why ${usdc(s.limit)} and not more`} style={{ marginBottom: 20 }}>
        <Stack gap={7} style={{ fontSize: 13.5 }}>
          {d.ladder.map((c) => (
            <div
              key={c.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 250px) minmax(0, 1fr) 120px 30px',
                gap: 12,
                alignItems: 'baseline',
                background: c.binding ? 'var(--color-accent-100)' : 'transparent',
                padding: '3px 8px',
              }}
            >
              <span>{c.label}</span>
              <span style={{ color: 'var(--color-neutral-600)', fontSize: 12.5 }}>{c.formula}</span>
              <span className="tabular" style={{ textAlign: 'right' }}>
                {Number.isFinite(c.value) ? usdc(c.value) : '—'}
              </span>
              <span style={{ color: 'var(--color-accent-800)' }}>
                {c.binding ? '◄' : c.advisory || c.nearBinding ? '⚠' : ''}
              </span>
            </div>
          ))}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 250px) minmax(0, 1fr) 120px 30px',
              gap: 12,
              borderTop: '1px solid var(--color-neutral-300)',
              padding: '6px 8px 0',
              fontWeight: 600,
            }}
          >
            <span>Approved = min(…)</span>
            <span />
            <span className="tabular" style={{ textAlign: 'right' }}>
              {usdc(s.limit)}
            </span>
            <span />
          </div>
        </Stack>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 12 }}>
          ◄ binding &nbsp;·&nbsp; ⚠ advisory, or would bind under a modest change in conditions. The
          exposure cap is measured against outstanding principal at draw time, so it caps what you
          can draw rather than what you are approved for.
        </div>
      </Section>

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
          <Button variant="ghost">Decision explanation</Button>
        </Link>
        <Link href="/credit/history">
          <Button variant="ghost">Limit history</Button>
        </Link>
      </ButtonRow>
    </Page>
  );
}
