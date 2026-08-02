'use client';

import {
  CUSTODY_ENFORCEMENT,
  CUSTODY_LABEL,
  CUSTODY_MULTIPLIER,
  DEFAULT_SPLIT,
  maxAdvanceRateFromHorizon,
  pct,
} from '@rivora/core';
import type { CustodyModel } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  ButtonRow,
  Callout,
  Kicker,
  Mono,
  RadioRow,
  SegmentedMeter,
  Stack,
  Tag,
} from '@rivora/ui';

const DESCRIPTIONS: Record<CustodyModel, string> = {
  A: 'Settled batches land directly in your Revenue Router, which splits them atomically. Diversion requires changing a registered settlement destination, which Rivora observes.',
  B: 'Settlement lands in a Circle Agent Wallet whose policy pays the router first. Rivora holds a policy-change veto.',
  C: 'You sweep a defined share to the router on a schedule. Rivora can detect diversion but cannot prevent it. Requires a security bond; the limit never exceeds reserve + bond.',
};

/**
 * S-12 — Custody model and router. screens.md §7.3
 *
 * The screen where the borrower learns that custody choice sets their advance
 * rate. Showing the multiplier next to each option — rather than burying it in
 * terms — is the whole point: PRD §11.3 makes custody an underwriting input, so
 * the trade has to be visible at the moment of choosing.
 */
export function StepCustody({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const ob = useProtocol((s) => s.onboarding);
  const set = useProtocol((s) => s.setOnboarding);
  const deploy = useProtocol((s) => s.deployRouter);

  const repaymentShare = DEFAULT_SPLIT.repaymentBps / 10_000;
  const reserveShare = DEFAULT_SPLIT.reserveBps / 10_000;
  const operatingShare = 1 - repaymentShare - reserveShare;
  const impliedAdvance = maxAdvanceRateFromHorizon(DEFAULT_SPLIT.repaymentBps, 45);

  return (
    <>
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-neutral-700)',
          margin: '0 0 18px',
          maxWidth: '64ch',
        }}
      >
        How will your revenue reach Rivora? This choice sets your maximum advance rate, because it
        determines whether repayment is structural.
      </p>

      <Stack gap={12} style={{ marginBottom: 24 }}>
        {(['A', 'B', 'C'] as CustodyModel[]).map((id) => {
          const selected = ob.custody === id;
          return (
            <Blueprint
              key={id}
              onClick={() => set('custody', id)}
              label={`Select custody model ${id} — ${CUSTODY_LABEL[id]}`}
              borderColor={selected ? 'var(--color-accent)' : 'var(--color-neutral-400)'}
              background={selected ? 'var(--color-accent-100)' : undefined}
              style={{ padding: '16px 20px' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 15,
                    letterSpacing: '0.06em',
                  }}
                >
                  {selected ? '◉' : '○'} MODEL {id} — {CUSTODY_LABEL[id]}
                </div>
                {id === 'A' ? <Tag tone="accent">Recommended</Tag> : null}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-neutral-700)',
                  margin: '6px 0 8px',
                  maxWidth: '70ch',
                }}
              >
                {DESCRIPTIONS[id]}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  fontSize: 12.5,
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.04em',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  ADVANCE RATE&nbsp; <strong>{CUSTODY_MULTIPLIER[id] * 100}% of tier base</strong>
                </span>
                <span>
                  REPAYMENT&nbsp; <strong>{CUSTODY_ENFORCEMENT[id]}</strong>
                </span>
              </div>
            </Blueprint>
          );
        })}
      </Stack>

      <Blueprint style={{ padding: '22px 26px' }}>
        <Kicker style={{ marginBottom: 12 }}>Revenue router</Kicker>
        <Stack gap={8} style={{ marginBottom: 18 }}>
          <RadioRow checked={ob.routerMode === 'link'} onSelect={() => set('routerMode', 'link')}>
            Link an existing router
          </RadioRow>
          <RadioRow checked={ob.routerMode === 'new'} onSelect={() => set('routerMode', 'new')}>
            Deploy a new router for this service
          </RadioRow>
        </Stack>

        <div style={{ fontSize: 14, marginBottom: 6 }}>
          Repayment share <strong>{pct(repaymentShare * 100, 0)}</strong> &nbsp;·&nbsp; Reserve share{' '}
          <strong>{pct(reserveShare * 100, 0)}</strong> &nbsp;·&nbsp; Operating{' '}
          <strong>{pct(operatingShare * 100, 0)}</strong>
        </div>
        <SegmentedMeter
          segments={[
            { ratio: repaymentShare, fill: 'var(--color-accent)', label: 'Repayment' },
            { ratio: reserveShare, fill: 'var(--color-accent-300)', label: 'Reserve' },
            { ratio: operatingShare, fill: 'var(--color-neutral-200)', label: 'Operating' },
          ]}
          style={{ marginBottom: 8 }}
        />
        <p style={{ fontSize: 12.5, color: 'var(--color-neutral-600)', margin: '0 0 18px' }}>
          At {pct(repaymentShare * 100, 0)} and a 45-day horizon your maximum advance rate is{' '}
          {pct(impliedAdvance * 100, 0)}. Raising the repayment share raises your advance rate.
        </p>

        {ob.deployed ? (
          <Callout severity="ok">
            RivoraRevenueRouter deployed at <Mono>0x7f3a…c1d2</Mono> · re-probe passed, payTo matches
            router
          </Callout>
        ) : null}

        <ButtonRow style={{ marginTop: 16 }}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          {ob.deployed || ob.routerMode === 'link' ? (
            <Button variant="primary" onClick={onNext}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" onClick={deploy}>
              Deploy router · ~0.02 USDC
            </Button>
          )}
        </ButtonRow>
      </Blueprint>
    </>
  );
}
