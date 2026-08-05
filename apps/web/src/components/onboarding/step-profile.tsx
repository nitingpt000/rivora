'use client';

import { COST_BANDS } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import { shortenAddress, useWallet } from '@rivora/wallet';
import {
  Blueprint,
  Button,
  ButtonRow,
  Field,
  Kicker,
  Mono,
  RadioRow,
  Select,
  Stack,
  TextInput,
} from '@rivora/ui';
import { useRouter } from 'next/navigation';

/** S-10 — Connect and profile. screens.md §7.1 */
export function StepProfile({ onNext }: { onNext: () => void; onBack: () => void }) {
  const ob = useProtocol((s) => s.onboarding);
  const set = useProtocol((s) => s.setOnboarding);
  const { address, balance } = useWallet();
  const router = useRouter();

  const canContinue = ob.serviceName.trim().length > 0 && ob.category.length > 0;
  const band = COST_BANDS[ob.category];

  return (
    <Blueprint style={{ padding: '26px 30px' }}>
      <Kicker style={{ marginBottom: 12 }}>Wallet</Kicker>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          border: '1px solid var(--color-neutral-300)',
          padding: '12px 16px',
          marginBottom: 26,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: address ? 'var(--color-ok)' : 'var(--color-warn)' }}>●</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Mono size={13}>{address ? shortenAddress(address) : 'No wallet connected'}</Mono>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
            {/*
              The real balance, read from the chain. This was the literal
              string "Circle Wallet · Arc Testnet · 42.10 USDC" — a figure
              that belonged to nobody, shown at the moment a provider is
              deciding whether they can afford to proceed.
            */}
            {address
              ? `Arc Testnet · ${balance ?? 'reading balance…'}`
              : 'Connect a wallet to register a service'}
          </div>
        </div>
      </div>

      <Kicker style={{ marginBottom: 12 }}>Service profile</Kicker>
      <Stack gap={14} style={{ marginBottom: 26 }}>
        <Field label="Service name">
          <TextInput value={ob.serviceName} onChange={(v) => set('serviceName', v)} />
        </Field>
        <Field
          label="Service category"
          hint={
            band
              ? `Cost band ${band.floor * 100}%–${band.ceiling * 100}% of price. Sets the operating-capacity factor. Changing it later triggers reassessment.`
              : undefined
          }
        >
          <Select
            value={ob.category}
            onChange={(v) => set('category', v)}
            options={Object.keys(COST_BANDS)}
          />
        </Field>
        <Field label="Short description">
          <TextInput value={ob.description} onChange={(v) => set('description', v)} />
        </Field>
      </Stack>

      <Kicker style={{ marginBottom: 12 }}>Operator</Kicker>
      <Stack gap={10} style={{ marginBottom: 8 }}>
        <RadioRow checked={ob.operator === 'agent'} onSelect={() => set('operator', 'agent')}>
          Autonomous agent, no legal operator
        </RadioRow>
        <RadioRow checked={ob.operator === 'named'} onSelect={() => set('operator', 'named')}>
          Named legal operator
        </RadioRow>
      </Stack>

      {ob.operator === 'named' ? (
        <Stack gap={12} style={{ marginLeft: 24, marginTop: 12 }}>
          <Field label="Entity name">
            <TextInput value={ob.entity} onChange={(v) => set('entity', v)} />
          </Field>
          <Field label="Jurisdiction">
            <TextInput value={ob.jurisdiction} onChange={(v) => set('jurisdiction', v)} />
          </Field>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
            KYB status &nbsp;⏱ Pending — required for cohort-1 borrowers
          </div>
        </Stack>
      ) : (
        <div style={{ marginLeft: 24, fontSize: 12.5, color: 'var(--color-neutral-600)' }}>
          An agent with no legal operator can still be underwritten, but recourse on default is
          limited to the reputation registry. Limits are capped accordingly.
        </div>
      )}

      <ButtonRow style={{ marginTop: 26 }}>
        <Button variant="ghost" onClick={() => router.push('/')}>
          Back
        </Button>
        <Button variant="primary" disabled={!canContinue} onClick={onNext}>
          Continue
        </Button>
      </ButtonRow>
    </Blueprint>
  );
}
