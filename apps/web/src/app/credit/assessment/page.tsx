'use client';

import { num, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  Callout,
  Card,
  CheckLine,
  Grid,
  KeyValue,
  Mono,
  Note,
  Page,
  PageHeader,
  Section,
  Stack,
  Terminal,
  TerminalLine,
} from '@rivora/ui';
import Link from 'next/link';

/**
 * S-27 — Assessment explanation. screens.md §8.8
 *
 * PRD §22.3 requires the limit calculation to be deterministic for the same
 * input set. The arithmetic block is that requirement made visible: the numbers
 * shown are the ones the engine used, and the export is the signal set the
 * `evidenceHash` commits to, so a third party can recompute independently.
 */
export default function AssessmentPage() {
  const s = useProtocol();
  const d = useDerived();

  const totalHaircut = d.penalties.reduce((a, p) => a + p.points, 0);
  const binding = d.ladder.find((c) => c.binding);
  const quality = d.ladder.find((c) => c.key === 'quality');

  const positives = [
    'Normalized 30-day eligible revenue increased 35% (10,000 → 13,500 USDC)',
    'Settlement success ratio improved from 88% to 96%',
    'Repeat payers increased from 95 to 168',
    'Largest payer share fell from 22% to 14%',
    'Tier advance rate increased from 20% to 30%',
  ];

  return (
    <Page measure="form">
      <PageHeader
        back={<Link href="/credit">← Credit</Link>}
        title="Assessment #2"
        aside={
          <Mono color="var(--color-neutral-600)">2026-08-01 12:47 UTC · ⧉ 0x39d5…8ca0</Mono>
        }
      />

      <Blueprint style={{ padding: '22px 28px', margin: '16px 0' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600 }}>
          Credit limit increased from {usdc(s.previousLimit)} to {usdc(s.limit)} USDC
        </div>
        <div style={{ fontSize: 14, marginTop: 6 }}>
          Risk score {s.previousScore} → {s.score} &nbsp;·&nbsp; Tier Standard → {s.tier}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 6 }}>
          Model riv-uw-2.1 · Evidence 0x2f81…7cd0 · Nonce 14 · Valid 24h
        </div>
      </Blueprint>

      {s.assessment?.explanation ? (
        <div style={{ marginBottom: 16 }}>
        <Callout severity="info">
          {s.assessment.explanation}
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
            Written after the decision, from the ladder below. It describes the outcome and had no
            part in reaching it — the limit is set by the constraint ladder alone.
          </div>
        </Callout>
        </div>
      ) : null}

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="Positive factors">
          <Stack gap={7} style={{ fontSize: 13, marginTop: 8 }}>
            {positives.map((p) => (
              <div key={p}>+ {p}</div>
            ))}
          </Stack>
        </Card>

        <Card kicker={`Limiting factors — ${num(totalHaircut, 2)}% quality haircut`}>
          <Stack gap={7} style={{ fontSize: 13, marginTop: 8 }}>
            {d.penalties.map((p) => (
              <KeyValue
                key={p.symbol}
                label={`− ${p.label}`}
                value={`${num(p.points, 2)} pts`}
              />
            ))}
            <KeyValue label="" value={`${num(totalHaircut, 2)} pts`} strong divider />
          </Stack>
        </Card>
      </Grid>

      <Blueprint
        borderColor="var(--color-accent-400)"
        background="var(--color-accent-100)"
        style={{ padding: '18px 24px', marginBottom: 16 }}
      >
        <div className="kicker" style={{ marginBottom: 8 }}>
          Binding constraint
        </div>
        <div style={{ fontSize: 14 }}>
          {binding?.label}.{' '}
          <strong>
            {binding?.formula} = {binding ? usdc(binding.value) : '—'}
          </strong>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-800)', marginTop: 6 }}>
          The quality-derived limit was {quality ? usdc(quality.value) : '—'} USDC. A further
          increase is available at the next assessment if performance holds — improving quality
          factors will not raise the limit this cycle.
        </div>
      </Blueprint>

      <Section
        title="Arithmetic"
        aside={
          <Button variant="ghost" compact>
            Reproduce → CSV
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Terminal minHeight={0}>
          <TerminalLine>
            Q = 1 − [
            {d.penalties
              .map((p) => `${p.weight.toFixed(2)}(${(1 - p.value).toFixed(2)})`)
              .join(' + ')}
            ] = {num(d.quality, 4)}
          </TerminalLine>
          <TerminalLine>
            L_quality = {usdc(s.eligibleRevenue)} × 0.30 × {num(d.quality, 4)} ×{' '}
            {num(s.factors.G, 2)} = {quality ? usdc(quality.value) : '—'}
          </TerminalLine>
          <TerminalLine mark="◄ binds">
            {binding?.label} = {binding ? usdc(binding.value) : '—'}
          </TerminalLine>
          <TerminalLine>Approved = {usdc(s.limit)}</TerminalLine>
        </Terminal>
      </Section>

      <Section title="Onchain validation">
        <Stack gap={6} style={{ fontSize: 13 }}>
          <CheckLine mark="pass">Signer authorized — 0xA9… underwriter key 3</CheckLine>
          <CheckLine mark="pass">Nonce 14 unused</CheckLine>
          <CheckLine mark="pass">Not expired — valid until 2026-08-02 12:47 UTC</CheckLine>
          <CheckLine mark="pass">
            Within protocol caps — recommended {usdc(s.limit)} ≤ tier cap 50,000
          </CheckLine>
          <CheckLine mark="pass">
            Credit Manager approved {usdc(s.limit)} (recommendation not reduced)
          </CheckLine>
        </Stack>
        <Note>
          ⓘ The narrative above is produced from these numbers. It never determines them. The
          contract accepts a recommendation only if it is within protocol bounds, and may approve
          less but never more.
        </Note>
      </Section>
    </Page>
  );
}
