'use client';

import { applyLossWaterfall, usdc } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import {
  Button,
  ButtonRow,
  Callout,
  CheckLine,
  DataTable,
  KeyValue,
  Mono,
  Page,
  PageHeader,
  Section,
  Stack,
} from '@rivora/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Loading } from '@/components/loading';
import { fullTime } from '@/lib/format';

interface Trigger {
  label: string;
  measured: string;
  fired: boolean;
}

/**
 * S-56 — Default declaration. screens.md §10.7
 *
 * Declaring a default is permanent, public and loss-realising, so it takes two
 * distinct operator signatures: one proposes here, another approves, and the
 * record commits only at quorum (PRD §19.8).
 *
 * Every figure is the named borrower's own. An earlier version ran the loss
 * waterfall over literal constants, which meant an operator read a preview of
 * a loss no borrower actually owed immediately before an irreversible action.
 */
export default function DeclareDefaultPage() {
  return (
    <Suspense fallback={<Loading label="Reading the borrower record" />}>
      <DeclareDefault />
    </Suspense>
  );
}

function DeclareDefault() {
  const params = useSearchParams();
  const handle = params.get('handle') ?? '';
  const router = useRouter();

  const borrower = useProtocol((s) => s.riskBorrower);
  const pending = useProtocol((s) => s.pendingDeclarations);
  const load = useProtocol((s) => s.loadRiskBorrower);
  const propose = useProtocol((s) => s.proposeDefault);
  const approve = useProtocol((s) => s.approveDefault);
  const busy = useProtocol((s) => s.pending);
  const error = useProtocol((s) => s.mutationError);

  const protocolReserve = useProtocol((s) => s.protocolReserve);
  const firstLossTranche = useProtocol((s) => s.firstLossTranche);

  const [trigger, setTrigger] = useState('');

  useEffect(() => {
    void load(handle);
  }, [handle, load]);

  if (!handle) {
    return (
      <Page measure="form">
        <Callout severity="info">
          Pick a borrower from the <Link href="/risk/watchlist">watchlist</Link> to declare against.
        </Callout>
      </Page>
    );
  }

  if (!borrower) return <Loading label="Reading the borrower record" />;

  const owed = borrower.principal + borrower.accruedInterest;
  const declaration = pending?.find((d) => d.handle === borrower.handle) ?? null;
  const alreadyDefaulted = borrower.status === 'DEFAULTED';

  /**
   * The triggers, measured against this borrower rather than asserted.
   *
   * Two of the four are computable from what the operator surface already
   * holds; the others need a time series this console does not load, so they
   * read as unknown rather than as not fired — "no" and "not checked" are
   * different answers, and only one of them is safe to act on.
   */
  const triggers: Trigger[] = [
    {
      label: 'Coverage ratio below 0.50',
      measured: borrower.coverageRatio.toFixed(2),
      fired: borrower.coverageRatio < 0.5,
    },
    {
      label: 'Score below the Ineligible band',
      measured: String(borrower.score),
      fired: borrower.score < 40,
    },
    { label: 'Endpoint binding broken, uncured 7 days', measured: 'not evaluated', fired: false },
    { label: 'No routed revenue for 21 days', measured: 'not evaluated', fired: false },
  ];

  const { layers } = applyLossWaterfall(owed, [
    { label: '1  Borrower loss reserve', available: borrower.reserve },
    { label: '2  Protocol first-loss tranche', available: firstLossTranche },
    { label: '3  Protocol loss reserve', available: protocolReserve },
    { label: '4  Liquidity-provider loss (socialized)', available: Number.POSITIVE_INFINITY },
  ]);

  return (
    <Page measure="form">
      <PageHeader
        back={<Link href="/risk">← Overview</Link>}
        title={
          <>
            Declare default — <Mono size={20}>{borrower.handle}</Mono>
          </>
        }
        size={28}
        lead={`${borrower.serviceName} · ${borrower.status} · this action is access-logged`}
      />

      {error ? <Callout severity="danger">{error}</Callout> : null}

      {alreadyDefaulted ? (
        <Callout severity="warn">
          This borrower is already in default. The record is permanent — open the{' '}
          <Link href="/recovery">cure path</Link> rather than declaring again.
        </Callout>
      ) : null}

      <DataTable<Trigger>
        caption="Automatic triggers"
        rows={triggers}
        rowKey={(t) => t.label}
        style={{ marginBottom: 14 }}
        columns={[
          { key: 'label', header: 'Trigger', render: (t) => t.label },
          {
            key: 'measured',
            header: 'Measured',
            align: 'right',
            render: (t) => <span className="tabular">{t.measured}</span>,
          },
          {
            key: 'fired',
            header: 'State',
            render: (t) => (
              <span style={{ color: t.fired ? 'var(--color-danger)' : 'var(--color-neutral-600)' }}>
                {t.measured === 'not evaluated' ? '· unknown' : t.fired ? '✓ FIRED' : '○ not yet'}
              </span>
            ),
          },
        ]}
        footer={
          <span>
            ⓘ Two triggers are computed from this borrower&rsquo;s live position. The remaining two
            need a time series this console does not load, so they read as unknown rather than as
            not fired.
          </span>
        }
      />

      <Section
        title={`Default waterfall — outstanding ${usdc(borrower.principal)} + ${usdc(borrower.accruedInterest)} interest`}
        style={{ marginBottom: 14 }}
      >
        <Stack gap={5} style={{ fontSize: 13, maxWidth: 560 }}>
          {layers.map((l) => (
            <KeyValue
              key={l.label}
              label={l.label}
              value={`${usdc(l.absorbed)} → ${usdc(l.remaining)}`}
            />
          ))}
        </Stack>
      </Section>

      <Section title="On commit" style={{ marginBottom: 16 }}>
        <Stack gap={5} style={{ fontSize: 13 }}>
          <CheckLine mark="pass">Permanent record written to the public default registry</CheckLine>
          <CheckLine mark="pass">Credit line set to DEFAULTED, limit withdrawn</CheckLine>
          <CheckLine mark="pass">Loss realised against the vault</CheckLine>
          <CheckLine mark="pass">
            Cure path opened — a record may be cured but never removed
          </CheckLine>
        </Stack>
      </Section>

      <Callout severity={declaration ? 'warn' : 'info'}>
        {declaration ? (
          <>
            <strong>
              Awaiting quorum — {declaration.signatures.length} of {declaration.required}{' '}
              signatures.
            </strong>{' '}
            Proposed {fullTime(declaration.createdAt)} for {usdc(declaration.principal)}:{' '}
            {declaration.trigger}.
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Signed by{' '}
              {declaration.signatures.map((s) => (
                <Mono key={s}>{`${s.slice(0, 6)}…${s.slice(-4)} `}</Mono>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-neutral-700)' }}>
              A second, distinct operator must approve. You cannot sign a declaration twice.
            </div>
          </>
        ) : (
          <>
            <strong>Two signatures required.</strong> Proposing opens a declaration and commits
            nothing; a second operator approves it, and only then is the record written.
          </>
        )}
      </Callout>

      {!declaration && !alreadyDefaulted ? (
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
            Trigger — recorded verbatim on the permanent record
            <input
              value={trigger}
              onChange={(event) => setTrigger(event.target.value)}
              placeholder="coverage ratio 0.31, uncured 16 days"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '8px 10px',
                border: '1px solid var(--color-neutral-400)',
                background: 'var(--color-bg)',
                font: 'inherit',
              }}
            />
          </label>
        </div>
      ) : null}

      <ButtonRow style={{ marginTop: 14 }}>
        <Link href="/risk">
          <Button variant="ghost">Cancel</Button>
        </Link>

        {declaration ? (
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              const result = await approve(declaration.id);
              if (result?.status === 'committed') router.push('/defaults');
            }}
          >
            {busy
              ? 'Signing…'
              : `Approve and commit (${declaration.signatures.length + 1}/${declaration.required})`}
          </Button>
        ) : (
          <Button
            variant="danger"
            disabled={busy || alreadyDefaulted || trigger.trim().length < 3 || owed <= 0}
            onClick={() =>
              void propose({
                handle: borrower.handle,
                principal: borrower.principal,
                trigger: trigger.trim(),
                // Placeholder until the evidence bundle is built and hashed —
                // the field is required so a record can never cite nothing.
                evidenceHash: `0xpending-${borrower.handle}`,
              })
            }
          >
            {busy ? 'Proposing…' : 'Propose default'}
          </Button>
        )}
      </ButtonRow>
    </Page>
  );
}
