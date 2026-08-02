'use client';

import { VAULT, num, pct, usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  BarRow,
  Blueprint,
  Button,
  ButtonRow,
  Card,
  Grid,
  KeyValue,
  KeyValueList,
  Meter,
  Money,
  Page,
  Section,
  Stack,
  Stat,
} from '@rivora/ui';
import Link from 'next/link';

/** S-40 — LP dashboard. screens.md §9.1 */
export default function VaultPage() {
  const s = useProtocol();
  const perf = s.performance;
  const d = useDerived();

  const loanBook = [
    { tier: 'Prime', value: 0 },
    { tier: 'Strong', value: 4_120 + Math.max(0, s.principal - 2_000) },
    { tier: 'Standard', value: 3_510 },
    { tier: 'Watch', value: 840 },
    { tier: 'Restricted', value: s.anomalyDetected ? s.principal : 0 },
  ];
  const bookTotal = loanBook.reduce((a, l) => a + l.value, 0) || 1;

  return (
    <Page measure="wide">
      <Grid cols={3} style={{ marginBottom: 14 }}>
        <Card kicker="Your position">
          <Money value={d.lpValue} size="lg" />
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            {num(s.lpShares)} shares · price {s.sharePrice.toFixed(6)}
          </div>
        </Card>
        <Card kicker="Interest earned">
          <Money value={d.lpEarned} size="lg" />
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            supplied {usdc(s.lpSupplied)}
          </div>
        </Card>
        <Card kicker="Net APY">
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 600 }}>
            {perf ? pct(perf.displayedApyPct) : '—'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            {perf ? `${pct(perf.organicApyPct)} organic + ${pct(perf.subsidyApyPct)} subsidy` : ''}
          </div>
        </Card>
      </Grid>

      {/*
        Mandatory and non-collapsible. PRD §23.7 and §32 both prohibit
        presenting subsidised yield as organic — a displayed APY that quietly
        includes a protocol subsidy is a misrepresentation of returns.
      */}
      <div
        style={{
          border: '1px solid var(--color-neutral-400)',
          padding: '12px 18px',
          fontSize: 12.5,
          color: 'var(--color-neutral-700)',
          marginBottom: 16,
        }}
      >
        ⓘ {pct(perf?.subsidyApyPct ?? 0)} of the displayed yield is a protocol bootstrap subsidy
        funded from the protocol reserve. It ends on {(perf?.subsidyEnds ?? '').slice(0, 10) || '—'}{' '}
        or when the subsidy cap is reached. Organic yield is {pct(perf?.organicApyPct ?? 0)}. Neither
        is guaranteed.
      </div>

      {s.lpQueued > 0 ? (
        <Blueprint
          borderColor="var(--color-accent-400)"
          background="var(--color-accent-100)"
          style={{ padding: '16px 22px', marginBottom: 16 }}
        >
          <div className="kicker" style={{ marginBottom: 8 }}>
            Withdrawal queue — position #1
          </div>
          <div className="tabular" style={{ fontSize: 13.5 }}>
            Requested {usdc(s.lpQueued)} USDC · Funded so far {usdc(s.lpQueueFunded)} USDC ·{' '}
            {pct(s.lpQueued > 0 ? (s.lpQueueFunded / s.lpQueued) * 100 : 0, 1)}
          </div>
          <Meter
            ratio={s.lpQueued > 0 ? s.lpQueueFunded / s.lpQueued : 0}
            height={9}
            maxWidth={380}
            style={{ margin: '8px 0' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" compact onClick={s.claimQueue}>
              Claim {usdc(s.lpQueueFunded)} now
            </Button>
            <Button variant="ghost" compact onClick={s.cancelQueue}>
              Cancel remainder
            </Button>
          </div>
        </Blueprint>
      ) : null}

      <Section title="Vault" style={{ marginBottom: 16 }}>
        <Grid cols={3} style={{ marginBottom: 16 }}>
          <Stat label="Total vault assets" value={`${usdc(s.vaultAssets)} USDC`} size={22} />
          <Stat label="Available liquidity" value={`${usdc(s.vaultLiquidity)} USDC`} size={22} />
          <Stat
            label="Outstanding loans"
            value={`${usdc(d.outstandingProtocolWide)} USDC`}
            size={22}
          />
        </Grid>

        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Utilization <strong>{pct(d.utilization * 100)}</strong>
        </div>
        <Meter
          ratio={d.utilization}
          height={14}
          markers={[
            { at: VAULT.feeStartUtilization, label: '80% kink' },
            { at: VAULT.maxUtilization, label: '85% cap' },
          ]}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--color-neutral-600)',
            marginTop: 6,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span>0%</span>
          <span>80% kink — rate steepens · 85% cap — draws blocked</span>
          <span>100%</span>
        </div>

        <div style={{ display: 'flex', gap: 28, fontSize: 13, marginTop: 14, flexWrap: 'wrap' }}>
          <span>
            Liquidity buffer <strong>{pct(d.bufferPct, 1)}</strong> · floor{' '}
            {pct(VAULT.bufferFloorPct * 100, 0)}{' '}
            <span style={{ color: 'var(--color-ok)' }}>✓</span>
          </span>
          <span>
            Withdrawal queue <strong>{usdc(s.queueTotal)} USDC</strong>
          </span>
        </div>
      </Section>

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="Rates">
          <KeyValueList>
            <KeyValue label="Vault base rate" value={pct(d.baseRatePct)} />
            <KeyValue
              label="Blended borrower rate"
              value={pct(perf?.blendedBorrowerRatePct ?? 0)}
            />
            <KeyValue label="Protocol spread" value={pct(perf?.protocolSpreadPct ?? 0)} />
            <KeyValue label="Your net organic" value={pct(perf?.organicApyPct ?? 0)} />
            <KeyValue label="Bootstrap subsidy" value={pct(perf?.subsidyApyPct ?? 0)} />
            <KeyValue label="Displayed APY" value={pct(perf?.displayedApyPct ?? 0)} strong />
          </KeyValueList>
        </Card>

        <Card kicker="Protection">
          <KeyValueList>
            <KeyValue
              label="First-loss tranche"
              value={`${usdc(s.firstLossTranche)} · ${pct(shareOfAssets(s.firstLossTranche, s.vaultAssets), 1)} ✓`}
            />
            <KeyValue
              label="Protocol reserve"
              value={`${usdc(s.protocolReserve)} · ${pct(shareOfAssets(s.protocolReserve, s.vaultAssets), 1)} ✓`}
            />
            <KeyValue label="Realized losses" value={usdc(s.realizedLosses)} />
            <KeyValue label="Active borrowers" value={String(s.activeBorrowers)} />
            <KeyValue label="Borrowers on watch" value={String(s.onWatch)} />
          </KeyValueList>
        </Card>
      </Grid>

      <Section
        title="Loan book by tier"
        aside={
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            Revenue coverage of principal {num(perf?.coverageMultiple ?? 0, 1)}×
          </span>
        }
        style={{ marginBottom: 20 }}
      >
        <Stack gap={7}>
          {loanBook.map((l) => (
            <BarRow
              key={l.tier}
              label={l.tier}
              value={usdc(l.value)}
              ratio={l.value / bookTotal}
              trailing={pct((l.value / bookTotal) * 100, 1)}
              labelWidth={100}
              valueWidth={90}
              barMaxWidth={320}
            />
          ))}
        </Stack>
      </Section>

      <ButtonRow align="center">
        <Button variant="primary" onClick={() => s.openModal('deposit')}>
          Deposit USDC
        </Button>
        <Button variant="secondary" onClick={() => s.openModal('withdraw')}>
          Withdraw
        </Button>
        <Link href="/vault/portfolio">
          <Button variant="ghost">Portfolio</Button>
        </Link>
        <Link href="/vault/performance">
          <Button variant="ghost">Performance</Button>
        </Link>
      </ButtonRow>
    </Page>
  );
}

/** A buffer as a percentage of total vault assets. */
function shareOfAssets(amount: number, assets: number): number {
  return assets > 0 ? (amount / assets) * 100 : 0;
}
