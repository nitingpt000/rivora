'use client';

import { useProtocol, type ActivityEvent } from '@rivora/protocol-sim';
import { DataTable, Mono, Note, Page, PageHeader, TxChip } from '@rivora/ui';

/** S-02 — Protocol activity. screens.md §6.2 */
export default function ActivityPage() {
  const events = useProtocol((s) => s.events);

  return (
    <Page measure="wide" paddingTop={36}>
      <PageHeader
        title="Protocol activity"
        aside={
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
            Arc Testnet · live event stream
          </span>
        }
      />

      <DataTable<ActivityEvent>
        rows={events}
        rowKey={(e, i) => `${e.tx}-${i}`}
        columns={[
          {
            key: 'time',
            header: 'Time',
            render: (e) => (
              <span className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {e.time}
              </span>
            ),
          },
          {
            key: 'event',
            header: 'Event',
            render: (e) => (
              <>
                <Mono size={12.5}>{e.type}</Mono>
                {e.note ? (
                  <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 2 }}>
                    {e.note}
                  </div>
                ) : null}
              </>
            ),
          },
          { key: 'who', header: 'Borrower', render: (e) => <Mono>{e.who}</Mono> },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (e) => <span className="tabular">{e.amount}</span>,
          },
          { key: 'tx', header: 'Tx', render: (e) => <TxChip hash={e.tx} /> },
        ]}
      />

      <Note>
        Never displayed here: payer addresses, per-customer revenue, endpoint URLs, borrower legal
        identity.
      </Note>
    </Page>
  );
}
