'use client';

import { COVERAGE, num, pct, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  Banner,
  Blueprint,
  Button,
  Card,
  Grid,
  KeyValue,
  KeyValueList,
  Mono,
  Page,
  PageHeader,
  Section,
  Stat,
  ThresholdPlot,
} from '@rivora/ui';

import { Loading } from '@/components/loading';
import { day, fullTime } from '@/lib/format';

/**
 * S-29 — Custody and endpoint binding. screens.md §8.10
 *
 * The screen that proves the credit is safe, and the borrower's own monitoring
 * tool. Under custody Model A, repayment is not an action the borrower takes —
 * this is where that claim is continuously re-verified (PRD §11.4).
 */
export default function CustodyPage() {
  const s = useProtocol();
  const d = useDerived();
  const custody = s.custody;
  const profile = s.profile;
  const revenue = s.revenue;

  if (!custody || !profile) return <Loading label="Reading custody and binding" />;

  const router = custody.routerAddress ?? 'not yet bound';

  return (
    <Page measure="narrow">
      {!s.bindingOk ? (
        <Banner
          severity="danger"
          emphasis
          title="BINDING BROKEN — advertised payTo no longer matches your Revenue Router"
          meta={
            <span className="mono">bound {router}</span>
          }
          actions={
            <>
              <Button variant="primary" onClick={s.restoreBinding}>
                Re-verify
              </Button>
              <Button variant="ghost" compact>
                Contact ops
              </Button>
            </>
          }
        >
          New draws are blocked and the repayment share has been raised to{' '}
          {custody.repaymentSharePct}%. Restore the binding within 7 days to avoid default.
        </Banner>
      ) : null}

      <PageHeader
        title="Custody and binding"
        aside={
          s.bindingOk ? (
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 13,
                letterSpacing: '0.1em',
                color: 'var(--color-ok)',
              }}
            >
              ● VERIFIED
            </span>
          ) : null
        }
      />

      <Blueprint
        style={{
          padding: '18px 24px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '0.04em' }}>
            CUSTODY MODEL A — Router is the settlement destination
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>
            Advance rate multiplier 100% of tier base · Repayment structural
          </div>
        </div>
        <Button variant="ghost" compact>
          Change model
        </Button>
      </Blueprint>

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="Binding">
          <KeyValueList>
            <KeyValue label="Endpoint" value={<Mono>{hostOf(profile.endpoint)}</Mono>} />
            <KeyValue label="Revenue Router" value={<Mono>{router}</Mono>} />
            <KeyValue
              label="Binding hash"
              value={<Mono>{custody.endpointHash ?? 'not yet written'}</Mono>}
            />
            <KeyValue label="Registered" value={fullTime(profile.registeredAt)} />
          </KeyValueList>
        </Card>

        <Card kicker="Live probe">
          <div
            className="mono"
            style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8, color: 'var(--color-neutral-800)' }}
          >
            GET {hostOf(profile.endpoint)} (unpaid) → {custody.endpointUp ? '402' : 'no response'}
            <br />
            bound router {router} &nbsp;
            <strong style={{ color: custody.bindingOk ? 'var(--color-ok)' : 'var(--color-danger)' }}>
              {custody.bindingOk ? '✓ MATCH' : '✕ MISMATCH'}
            </strong>
            <br />
            asset USDC · chain Arc · latency {s.latencyMs}ms
          </div>
          <div style={{ fontSize: 12, marginTop: 10, color: 'var(--color-neutral-700)' }}>
            Uptime {pct(custody.uptimePct, 1)} · fulfilment {pct(s.successPct, 1)}
          </div>
        </Card>
      </Grid>

      <Section title="Routed-revenue coverage" style={{ marginBottom: 14 }}>
        <Grid cols={3} style={{ marginBottom: 14 }}>
          <Stat
            label="Expected routed"
            value={usdc(d.expectedRouted)}
            caption={
              revenue
                ? `${num(revenue.settled, 0)} settled × ${num(revenue.meanPrice, 3)} mean`
                : undefined
            }
          />
          <Stat label="Actual routed" value={usdc(s.eligibleRevenue)} />
          <Stat
            label="Coverage ratio"
            value={
              <>
                {num(custody.coverageRatio, 2)}{' '}
                <span
                  style={{
                    fontSize: 13,
                    color:
                      d.routedState === 'consistent' ? 'var(--color-ok)' : 'var(--color-warn)',
                  }}
                >
                  {d.routedState === 'consistent' ? '✓ consistent' : `⚠ ${d.routedState}`}
                </span>
              </>
            }
          />
        </Grid>
        <ThresholdPlot
          thresholds={[
            { atPct: 40, label: `${num(COVERAGE.routedReview, 2)} review threshold` },
            { atPct: 75, label: `${num(COVERAGE.routedDiversion, 2)} diversion threshold` },
          ]}
          axis={{ left: day(revenue?.windowStart), right: day(revenue?.windowEnd) }}
        />
      </Section>

      <Section title="Revenue split at the router">
        <Grid cols={3}>
          <Stat label="To repayment" value={pct(custody.repaymentSharePct, 0)} size={15} />
          <Stat label="To loss reserve" value={pct(custody.reserveSharePct, 0)} size={15} />
          <Stat label="To operating wallet" value={pct(custody.operatingSharePct, 0)} size={15} />
        </Grid>
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', marginTop: 12 }}>
          Revenue is counted for underwriting at <Mono>paidAt</Mono>, which is earlier than it is
          available for repayment — settlement batches net before they reach the router. The grace
          period must exceed the maximum settlement interval, or the protocol would default
          borrowers whose repayment is already in the batch queue.
        </div>
      </Section>
    </Page>
  );
}

/** Host of a URL, or the raw string if it will not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
