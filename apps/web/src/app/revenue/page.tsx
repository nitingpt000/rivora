'use client';

import { coefficientOfVariation, num, pct, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  BarRow,
  Button,
  Card,
  Delta,
  Grid,
  KeyValue,
  KeyValueList,
  Money,
  Page,
  PageHeader,
  Section,
  Sparkbars,
  Stack,
  Tag,
} from '@rivora/ui';
import Link from 'next/link';

import { BorrowerBanner } from '@/components/borrower-banner';
import { Loading } from '@/components/loading';
import { day } from '@/lib/format';

/** S-21 — Revenue analytics. screens.md §8.2 */
export default function RevenuePage() {
  const s = useProtocol();
  const d = useDerived();
  const revenue = s.revenue;

  if (!revenue) return <Loading label="Reading settled revenue" />;

  const excludedPct = revenue.gross > 0 ? (revenue.excluded / revenue.gross) * 100 : 0;
  const series = revenue.dailySeries;

  // The excluded share is reported for the window, not per day, so it is drawn
  // as a flat proportion of each bar rather than invented day by day.
  const excludedShare = revenue.gross > 0 ? revenue.excluded / revenue.gross : 0;
  const bars = series.map((value) => ({
    value,
    secondary: value * excludedShare,
  }));

  const median = medianOf(series);
  const stdDev = standardDeviation(series);

  return (
    <Page measure="wide">
      <BorrowerBanner />
      <PageHeader
        title="Revenue"
        aside={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag tone="neutral">Window · 30 days</Tag>
            <Button variant="ghost" compact>
              Export CSV
            </Button>
          </div>
        }
      />

      <Grid cols={4} style={{ marginBottom: 16 }}>
        <Card kicker="Gross">
          <Money value={revenue.gross} size="md" />
        </Card>
        <Card kicker="Eligible">
          <Money value={revenue.eligible} size="md" />
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>normalized</div>
        </Card>
        <Link href="/revenue/excluded" style={{ display: 'contents' }}>
          <Card kicker="Excluded">
            <Money value={revenue.excluded} size="md" />
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
              {pct(excludedPct, 1)} of gross →
            </div>
          </Card>
        </Link>
        <Card kicker="Growth">
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 600 }}>
            <Delta value={revenue.growthPct} suffix="%" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>vs prior 30 days</div>
        </Card>
      </Grid>

      <Section
        title="Daily revenue"
        aside={
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
            ▓ eligible &nbsp;░ excluded
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <Sparkbars
          bars={bars}
          height={140}
          axis={{ left: day(revenue.windowStart), right: day(revenue.windowEnd) }}
          caption={`mean ${usdc(revenue.dailyMean)} · median ${usdc(median)} · σ ${num(stdDev)} · CV ${num(coefficientOfVariation(series), 3)}`}
        />
      </Section>

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="Requests">
          <KeyValueList>
            <KeyValue label="Authorizations issued" value={num(revenue.requests, 0)} />
            <KeyValue label="Settled successfully" value={num(revenue.settled, 0)} />
            <KeyValue label="Failed / unfulfilled" value={num(revenue.failed, 0)} />
            <KeyValue label="Refunded" value={num(revenue.refunded, 0)} />
            <KeyValue label="Success ratio" value={pct(s.successPct, 1)} />
            <KeyValue label="Mean price per request" value={num(revenue.meanPrice, 3)} />
          </KeyValueList>
        </Card>

        <Link href="/revenue/customers" style={{ display: 'contents' }}>
          <Card
            kicker="Customers"
            aside={
              <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>
                Concentration →
              </span>
            }
          >
            <KeyValueList>
              <KeyValue label="Unique eligible payers" value={num(revenue.uniquePayers, 0)} />
              <KeyValue label="Repeat payers" value={num(revenue.repeatPayers, 0)} />
              <KeyValue label="Repeat rate" value={pct(revenue.repeatRatePct, 1)} />
              <KeyValue label="New payers this window" value={num(revenue.newPayers, 0)} />
              <KeyValue
                label="Median payer lifetime"
                value={`${revenue.medianPayerLifetimeDays} d`}
              />
              <KeyValue label="Largest payer share" value={pct(revenue.largestPayerPct, 0)} />
            </KeyValueList>
          </Card>
        </Link>
      </Grid>

      <Section
        title="Underwriting factors"
        aside={<Link href="/credit/assessment">How these are used →</Link>}
      >
        <Stack gap={9}>
          {d.penalties.map((p) => (
            <BarRow
              key={p.symbol}
              leading={p.symbol}
              label={p.label}
              value={num(p.value, 2)}
              ratio={p.value}
              trailing={`penalty ${num(p.points, 2)} pts`}
              labelWidth={210}
              valueWidth={60}
            />
          ))}
        </Stack>
        <div
          style={{
            borderTop: '1px solid var(--color-neutral-300)',
            marginTop: 12,
            paddingTop: 10,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13.5,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span>
            Quality factor Q = <strong>{num(d.quality, 4)}</strong>
          </span>
          <span>
            G Revenue growth <strong>{num(s.factors.G, 2)}</strong> (uplift, capped)
          </span>
        </div>
      </Section>
    </Page>
  );
}

/** Middle value of a series, or the mean of the two middle values. */
function medianOf(series: readonly number[]): number {
  if (series.length === 0) return 0;
  const sorted = [...series].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function standardDeviation(series: readonly number[]): number {
  if (series.length < 2) return 0;
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  return Math.sqrt(series.reduce((sum, v) => sum + (v - mean) ** 2, 0) / series.length);
}
