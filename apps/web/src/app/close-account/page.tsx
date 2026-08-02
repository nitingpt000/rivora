'use client';

import { usdc } from '@rivora/core';
import { useDerived, useProtocol } from '@rivora/protocol-sim';
import {
  Button,
  ButtonRow,
  Card,
  CheckLine,
  Grid,
  KeyValue,
  KeyValueList,
  Note,
  Page,
  PageHeader,
  Section,
  Stack,
} from '@rivora/ui';
import { useRouter } from 'next/navigation';

/** S-34 — Account closure. screens.md §8.15 */
export default function CloseAccountPage() {
  const s = useProtocol();
  const d = useDerived();
  const router = useRouter();

  const debtCleared = d.owed < 0.005;

  return (
    <Page measure="tight">
      <PageHeader title="Close account" />

      <Section title="Closure conditions" style={{ marginBottom: 14 }}>
        <Stack gap={7} style={{ fontSize: 13.5 }}>
          <CheckLine mark={debtCleared ? 'pass' : 'fail'} value={`${usdc(d.owed)} USDC`}>
            Outstanding debt equals zero
          </CheckLine>
          <CheckLine mark="pass" value="0.00 USDC">
            Pending repayments equal zero
          </CheckLine>
          <CheckLine mark="pass" value="none open">
            No active dispute
          </CheckLine>
          <CheckLine mark="pending" value="18 of 30 days">
            Reserve release period elapsed
          </CheckLine>
        </Stack>
      </Section>

      <Grid cols={2} style={{ marginBottom: 16 }}>
        <Card kicker="On closure">
          <KeyValueList>
            <KeyValue label="Reserve returned" value={`${usdc(s.reserveTarget)} USDC`} />
            <KeyValue label="Security bond returned" value="0.00 USDC" />
          </KeyValueList>
          <div style={{ fontSize: 13, marginTop: 8, color: 'var(--color-neutral-700)' }}>
            Revenue Router unbound — revenue routes 100% to you.
          </div>
        </Card>

        <Card kicker="Retained after closure">
          <Stack gap={6} style={{ fontSize: 12.5, marginTop: 8, color: 'var(--color-neutral-700)' }}>
            <div>Default registry records (none for this account)</div>
            <div>Aggregate repayment history for reputation attestations</div>
            <div>Audit records required by the retention policy</div>
            <div style={{ color: 'var(--color-neutral-600)' }}>
              Deleted: payer data, endpoint URL, revenue detail, KYB record
            </div>
          </Stack>
        </Card>
      </Grid>

      <Note style={{ margin: '0 0 16px' }}>
        ⓘ Closing does not erase your reputation. Reopening with the same endpoint and owner restores
        your history — identity is bound to the owner wallet, the endpoint domain and the router
        together.
      </Note>

      <ButtonRow>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          Cancel
        </Button>
        <Button variant="danger" disabled={!debtCleared}>
          Close account in 12 days
        </Button>
      </ButtonRow>
    </Page>
  );
}
