'use client';

import { usdc } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  ButtonRow,
  Callout,
  Kicker,
  Mono,
  Note,
  Page,
  StatCell,
  Stack,
} from '@rivora/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { Loading } from '@/components/loading';
import { fullTime } from '@/lib/format';

/**
 * S-03 — Public reputation page. screens.md §6.3
 *
 * The human-readable rendering of the signed attestation, and the reason
 * reputation is worth anything: a marketplace or counterparty checks this
 * before extending its own credit. It carries creditworthiness without
 * disclosing the revenue data underneath (PRD §19.6).
 *
 * Public, and read by handle rather than from the session — the counterparty
 * looking someone up is not that someone.
 */
export default function ReputationPage() {
  return (
    <Suspense fallback={<Loading label="Reading the reputation card" />}>
      <ReputationCard />
    </Suspense>
  );
}

function ReputationCard() {
  const params = useSearchParams();
  const ownHandle = useProtocol((s) => s.profile?.handle);
  const handle = params.get('handle') ?? ownHandle ?? '';

  const card = useProtocol((s) => s.reputation);
  const error = useProtocol((s) => s.reputationError);
  const loadReputation = useProtocol((s) => s.loadReputation);

  useEffect(() => {
    void loadReputation(handle);
  }, [handle, loadReputation]);

  if (!handle) {
    return (
      <Page measure="form" paddingTop={36}>
        <Callout severity="info">
          Name a borrower to look up — <Mono>/reputation?handle=…</Mono> — or connect the wallet
          whose record you want to see.
        </Callout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page measure="form" paddingTop={36}>
        <Callout severity="danger">{error}</Callout>
      </Page>
    );
  }

  if (!card) return <Loading label="Reading the reputation card" />;

  return (
    <Page measure="form" paddingTop={36}>
      <Kicker style={{ color: 'var(--color-accent-700)', marginBottom: 14 }}>
        Machine credit reputation
      </Kicker>

      <Blueprint style={{ padding: '28px 32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Mono size={20}>{card.handle}</Mono>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 4 }}>
              Endpoint hash <Mono>{card.endpointHash ?? 'not yet bound'}</Mono>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 15,
                letterSpacing: '0.1em',
                color: 'var(--color-accent-700)',
              }}
            >
              ● {card.tier.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 600 }}>
              {card.score}{' '}
              <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--color-neutral-600)' }}>
                / 100
              </span>
            </div>
          </div>
        </div>

        <div
          className="riv-grid riv-grid-3"
          style={{ border: '1px solid var(--color-neutral-300)', gap: 0 }}
        >
          <StatCell
            label="Months observed"
            value={String(card.monthsObserved)}
            borderRight
            borderBottom
          />
          <StatCell
            label="Repayment cycles"
            value={`${card.repaymentCycles} complete`}
            borderRight
            borderBottom
          />
          <StatCell label="On-time ratio" value={`${card.onTimeRatioPct}%`} borderBottom />
          <StatCell
            label="Principal repaid"
            value={`${usdc(card.principalRepaid)} USDC`}
            borderRight
          />
          <StatCell label="Defaults recorded" value={String(card.defaultsRecorded)} borderRight />
          <StatCell
            label="Custody model"
            value={card.custody === 'A' ? 'A — structural' : card.custody}
          />
        </div>

        <div style={{ marginTop: 26 }}>
          <Kicker style={{ marginBottom: 12 }}>Signal bands</Kicker>
          <Stack gap={8}>
            {card.bands.map((b) => (
              <div
                key={b.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(140px, 200px) minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: 14,
                  fontSize: 13,
                }}
              >
                <span>{b.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.08em',
                    fontSize: 12,
                    color: 'var(--color-accent-700)',
                  }}
                >
                  {b.band}
                </span>
              </div>
            ))}
          </Stack>
          <Note>
            Bands, not values. A counterparty learns that concentration is low without learning who
            the customers are.
          </Note>
        </div>

        <div
          style={{
            marginTop: 26,
            paddingTop: 18,
            borderTop: '1px solid var(--color-neutral-300)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
            Attested {fullTime(card.attestedAt)} · model {card.model}
          </div>
          <ButtonRow>
            <Button
              variant="ghost"
              onClick={() => void navigator.clipboard?.writeText(JSON.stringify(card, null, 2))}
            >
              Copy JSON
            </Button>
          </ButtonRow>
        </div>
      </Blueprint>

      <Note>
        Not disclosed: revenue figures, payer identities, per-customer split, endpoint URL, operator
        identity.
      </Note>
    </Page>
  );
}
