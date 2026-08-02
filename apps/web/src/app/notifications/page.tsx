'use client';

import { useProtocol } from '@rivora/protocol-sim';
import { Blueprint, Button, Kicker, Page, PageHeader, Section, Stack, Tag, TxChip } from '@rivora/ui';
import Link from 'next/link';

const SUBSCRIBED = [
  ['revenue.received', 'credit.draw.completed'],
  ['revenue.settled', 'credit.repayment.completed'],
  ['risk.assessment.completed', 'borrower.watchlisted'],
  ['credit.limit.updated', 'borrower.restricted'],
  ['borrower.defaulted', 'vault.utilization.changed'],
];

/** S-70 — Notifications. screens.md §12.1 */
export default function NotificationsPage() {
  const notifications = useProtocol((s) => s.notifications);
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <Page measure="form">
      <PageHeader title="Notifications" aside={<Tag tone="accent">Unread {unread}</Tag>} />

      <Blueprint style={{ marginBottom: 16 }}>
        {notifications.map((n, i) => (
          <div
            key={`${n.title}-${i}`}
            style={{
              display: 'flex',
              gap: 14,
              padding: '13px 20px',
              borderBottom: '1px solid var(--color-neutral-200)',
              alignItems: 'flex-start',
              background: n.unread ? 'var(--color-accent-100)' : 'transparent',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-neutral-600)',
                width: 48,
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {n.time}
            </span>
            <span style={{ width: 20, flexShrink: 0 }}>{n.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.title}</div>
              {n.body ? (
                <div style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{n.body}</div>
              ) : null}
              {n.href && n.cta ? (
                <Link href={n.href} style={{ fontSize: 12 }}>
                  {n.cta} →
                </Link>
              ) : null}
            </div>
            {n.tx ? <TxChip hash={n.tx} /> : null}
          </div>
        ))}
      </Blueprint>

      <Section title="Delivery">
        <Stack gap={6} style={{ fontSize: 13, marginBottom: 16 }}>
          <div>☑ In-app — always on</div>
          <div>☑ Email — ops@quotestream.dev</div>
          <div>
            ☑ Webhook — <span className="mono">https://api.quotestream.dev/hooks/rivora</span> ·
            signing secret whsec_… · last delivery 14:31:09 · 200 OK · 84ms
          </div>
        </Stack>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Button variant="ghost" compact>
            Rotate secret
          </Button>
          <Button variant="ghost" compact>
            Send test
          </Button>
        </div>

        <Kicker style={{ marginBottom: 10 }}>Subscribed events</Kicker>
        <div
          className="riv-grid riv-grid-2"
          style={{ gap: 5, fontSize: 12.5, color: 'var(--color-neutral-700)' }}
        >
          {SUBSCRIBED.flat().map((event, i) => (
            <span key={event} className="mono">
              {i === SUBSCRIBED.flat().length - 1 ? '☐' : '☑'} {event}
            </span>
          ))}
        </div>
      </Section>
    </Page>
  );
}
