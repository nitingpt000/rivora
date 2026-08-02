'use client';

import { pct } from '@rivora/core';
import {
  BarRow,
  Button,
  Card,
  Grid,
  KeyValue,
  KeyValueList,
  Mono,
  Note,
  Page,
  PageHeader,
  Section,
  Stack,
  Tag,
} from '@rivora/ui';

import { useProtocol } from '@rivora/protocol-sim';

/** S-60 — Partner console. screens.md §11.1 */
export default function PartnerConsolePage() {
  const distribution = useProtocol((s) => s.distribution) ?? [];

  return (
    <Page measure="mid">
      <PageHeader
        title="Partner console"
        aside={
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>AgentMarket Inc</span>
        }
      />

      <Section title="Products" style={{ marginBottom: 14 }}>
        <Stack gap={6} style={{ fontSize: 13.5 }}>
          <KeyValue
            label={
              <>
                <span style={{ color: 'var(--color-ok)' }}>●</span> Score API — active since
                2026-07-01
              </>
            }
            value={<Tag tone="accent">active</Tag>}
          />
          <KeyValue
            label={
              <>
                <span style={{ color: 'var(--color-neutral-500)' }}>○</span> Router as a service
              </>
            }
            value={
              <Button variant="ghost" compact>
                Request
              </Button>
            }
          />
          <KeyValue
            label={
              <>
                <span style={{ color: 'var(--color-neutral-500)' }}>○</span> Delegated credit pool
              </>
            }
            value={
              <Button variant="ghost" compact>
                Request
              </Button>
            }
          />
        </Stack>
      </Section>

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="Usage, 30 days">
          <KeyValueList>
            <KeyValue label="Score requests" value="14,210" />
            <KeyValue label="Unique subjects" value="1,884" />
            <KeyValue label="Mean latency" value="212ms" />
            <KeyValue label="Rate limit" value="200 / minute" />
            <KeyValue label="Errors" value="0.04%" />
            <KeyValue label="Billable" value="14,210" />
          </KeyValueList>
        </Card>

        <Card kicker="Keys & model versions">
          <KeyValueList>
            <KeyValue label={<Mono>pk_live_8f2…</Mono>} value="prod · ● active" />
            <KeyValue label={<Mono>pk_test_31a…</Mono>} value="sandbox · ● active" />
            <KeyValue label="Scopes" value={<Mono>score:read · reputation:read</Mono>} />
            <KeyValue label="Pinned model" value="riv-uw-2.1 — decisions reproducible" />
            <KeyValue label="Upgrade policy" value="Manual — notify 30 d before deprecation" />
          </KeyValueList>
          <Note style={{ marginTop: 8 }}>
            Pinning the model version is what keeps a partner&rsquo;s past decisions reproducible
            after Rivora upgrades its underwriting.
          </Note>
        </Card>
      </Grid>

      <Section title="Score distribution of your subjects" style={{ marginBottom: 14 }}>
        <Stack gap={7}>
          {distribution.map((d) => (
            <BarRow
              key={d.tier}
              label={d.tier}
              ratio={d.sharePct / 100}
              trailing={`${pct(d.sharePct, 1)} · ${d.subjects} subjects`}
              labelWidth={100}
              barMaxWidth={300}
            />
          ))}
        </Stack>
        <Note>
          ⓘ Subject-level detail is not available through this console. You receive bands and scores
          per query, never the underlying revenue data.
        </Note>
      </Section>

      <div
        style={{
          border: '1px solid var(--color-neutral-400)',
          padding: '14px 20px',
          fontSize: 12.5,
          color: 'var(--color-neutral-700)',
        }}
      >
        <strong>Exposure (delegated pools)</strong> — not enabled. A delegated pool requires you to
        fund a first-loss tranche and is available after Rivora&rsquo;s own book has two quarters of
        loss data. A scoring model with no realized-loss history is not something a partner can
        underwrite against.
      </div>
    </Page>
  );
}
