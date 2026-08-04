'use client';

import { usdc } from '@rivora/core';
import { useProtocol, type PolicyDecision } from '@rivora/protocol-sim';
import {
  Card,
  DataTable,
  Grid,
  KeyValue,
  Meter,
  Mono,
  Note,
  Page,
  PageHeader,
  Stack,
  Tag,
} from '@rivora/ui';

import { Loading } from '@/components/loading';
import { clock, day } from '@/lib/format';

const DECISION_COLOR: Record<string, string> = {
  allowed: 'var(--color-ok)',
  rejected: 'var(--color-danger)',
  queued: 'var(--color-warn)',
};

const DECISION_GLYPH: Record<string, string> = {
  allowed: '✓',
  rejected: '✕',
  queued: '⏱',
};

/** S-30 — Agent spending policy. screens.md §8.11 */
export default function PolicyPage() {
  const policy = useProtocol((s) => s.policy);
  const operatingWallet = useProtocol((s) => s.profile?.operatingWallet);

  if (!policy) return <Loading label="Reading the agent policy" />;

  const dailyUsed = policy.maxDaily > 0 ? policy.spentToday / policy.maxDaily : 0;

  const counts = policy.decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.outcome] = (acc[d.outcome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Page measure="narrow">
      <PageHeader
        title="Agent spending policy"
        aside={
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
            Wallet <Mono>{operatingWallet ?? '—'}</Mono> · Circle
          </span>
        }
      />

      <Grid cols={2} style={{ marginBottom: 14 }}>
        <Card kicker="Limits">
          <Stack gap={10} style={{ fontSize: 13, marginTop: 10 }}>
            <KeyValue
              label="Maximum individual payment"
              value={<Boxed>{usdc(policy.maxPayment)} USDC</Boxed>}
            />
            <div>
              <KeyValue
                label="Maximum daily spending"
                value={<Boxed>{usdc(policy.maxDaily)} USDC</Boxed>}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <Meter ratio={dailyUsed} style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
                  used today {usdc(policy.spentToday)} · {(dailyUsed * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <KeyValue
              label="Human approval threshold"
              value={<Boxed>{usdc(policy.humanApprovalThreshold)} USDC</Boxed>}
            />
          </Stack>

          <div className="card-kicker" style={{ marginTop: 18 }}>
            Allowed categories
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {policy.allowedCategories.map((c) => (
              <Tag key={c} tone="accent">
                ✓ {c}
              </Tag>
            ))}
            {policy.blockedCategories.map((c) => (
              <Tag key={c} tone="outline">
                ✕ {c}
              </Tag>
            ))}
          </div>
        </Card>

        <Card kicker="Recipient allowlist">
          <Stack gap={8} style={{ fontSize: 12.5, marginTop: 8 }}>
            {policy.allowlist.length === 0 ? (
              <span style={{ color: 'var(--color-neutral-600)' }}>
                No recipient registered yet.
              </span>
            ) : null}
            {policy.allowlist.map((a) => (
              <div
                key={a.address}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(100px, 110px) minmax(0, 1fr) 80px 100px',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <Mono>{a.address}</Mono>
                <span>{a.name}</span>
                <Tag tone="neutral" style={{ justifySelf: 'start' }}>
                  {a.category}
                </Tag>
                <span style={{ color: 'var(--color-neutral-600)' }}>
                  {a.lastUsedAt ? day(a.lastUsedAt) : 'unused'}
                </span>
              </div>
            ))}
          </Stack>

          <Note>
            An allowlist is what makes a compromised agent&rsquo;s spending bounded rather than
            merely capped: a stolen key can spend up to the daily limit, but only to addresses the
            owner registered. It governs payments the agent makes <em>out of</em> the operating
            wallet — a draw is paid to that wallet itself, so the caps and categories are what
            bound a draw, not this list.
          </Note>
        </Card>
      </Grid>

      <DataTable<PolicyDecision>
        caption="Decision log"
        rows={policy.decisions}
        rowKey={(d) => `${d.at}-${d.recipient}`}
        detail={(d) => d.reason || undefined}
        empty="The agent has not attempted a payment yet."
        style={{ marginBottom: 14 }}
        columns={[
          { key: 'time', header: 'Time', render: (d) => clock(d.at) },
          { key: 'recipient', header: 'Recipient', render: (d) => <Mono>{d.recipient}</Mono> },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (d) => <span className="tabular">{usdc(d.amount)}</span>,
          },
          { key: 'category', header: 'Category', render: (d) => d.category },
          {
            key: 'decision',
            header: 'Decision',
            render: (d) => (
              <span style={{ color: DECISION_COLOR[d.outcome] ?? 'var(--color-neutral-700)' }}>
                {DECISION_GLYPH[d.outcome] ?? '·'} {d.outcome}
              </span>
            ),
          },
        ]}
        footer={
          <span>
            {counts.allowed ?? 0} allowed · {counts.rejected ?? 0} rejected · {counts.queued ?? 0}{' '}
            required human approval
          </span>
        }
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Note style={{ margin: 0, maxWidth: '60ch' }}>
          ⓘ These limits are enforced on every draw — a request above the single-payment or daily
          cap, or in a blocked category, is refused and the refusal is recorded above. Changes take
          effect after a {policy.policyChangeDelayHours}h delay while you have outstanding debt, so
          a compromised agent cannot widen its own limits and immediately draw against them.
          <br />
          <br />
          Editing is not yet available on this screen; the policy is changed through{' '}
          <Mono>PATCH /policy</Mono>. This console previously carried a Save button that did
          nothing, which is worse than none.
        </Note>
      </div>
    </Page>
  );
}

function Boxed({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="tabular"
      style={{ border: '1px solid var(--color-neutral-400)', padding: '3px 10px' }}
    >
      {children}
    </span>
  );
}
