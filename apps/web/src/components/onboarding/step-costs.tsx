'use client';

import { COST_BANDS, M_CEILING, num, pct } from '@rivora/core';
import { useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  ButtonRow,
  CheckRow,
  Field,
  Kicker,
  Mono,
  Stack,
  TextInput,
} from '@rivora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const TERMS = [
  'I understand credit limits are dynamic and may be reduced.',
  "I understand my Revenue Router's total throughput is publicly visible onchain. Payer identity and per-customer split are not.",
  'I understand defaults are recorded permanently and may be cured but not removed.',
  'I accept the protocol terms and testnet disclaimer.',
];

/**
 * S-13 — Costs, operating wallet, terms. screens.md §7.4
 *
 * The router-throughput disclosure is a required checkbox, not fine print. PRD
 * §21.4 is blunt about why: a borrower who discovers it after routing six
 * months of revenue is a borrower lost, and the disclosure costs nothing when
 * made up front.
 */
export function StepCosts({ onBack }: { onNext: () => void; onBack: () => void }) {
  const ob = useProtocol((s) => s.onboarding);
  const set = useProtocol((s) => s.setOnboarding);
  const toggleTerm = useProtocol((s) => s.toggleTerm);
  const complete = useProtocol((s) => s.completeOnboarding);
  const policy = useProtocol((s) => s.policy);
  // Blank until registration links a wallet, which is what this step completes.
  const operatingWallet = useProtocol((s) => s.profile?.operatingWallet ?? s.user?.address ?? '—');
  const router = useRouter();

  const price = parseFloat(ob.pricePerRequest) || 0;
  const cost = parseFloat(ob.costPerRequest) || 0;
  const costPct = price > 0 ? (cost / price) * 100 : 0;
  const band = COST_BANDS[ob.category] ?? { floor: 0.1, ceiling: 0.5 };
  const inBand = costPct >= band.floor * 100 && costPct <= band.ceiling * 100;
  const allAccepted = ob.terms.every(Boolean);

  return (
    <Blueprint style={{ padding: '26px 30px' }}>
      <Kicker style={{ marginBottom: 8 }}>Wallets</Kicker>
      <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: '0 0 10px' }}>
        Settled revenue arrives at the revenue wallet and is split by the router; your share
        reaches the operating wallet, which is also where borrowed funds are paid. Both default
        to the wallet you signed in with — keeping them separate lets you rotate the key your
        agent spends from without touching the one that authorises changes.
      </p>
      <Stack gap={12} style={{ marginBottom: 18 }}>
        <Field label="Operating wallet — leave blank to use the connected wallet">
          <TextInput
            value={ob.operatingWallet}
            onChange={(v) => set('operatingWallet', v)}
            placeholder={operatingWallet}
          />
        </Field>
        <Field label="Revenue wallet — leave blank to use the connected wallet">
          <TextInput
            value={ob.revenueWallet}
            onChange={(v) => set('revenueWallet', v)}
            placeholder={operatingWallet}
          />
        </Field>
      </Stack>
      <div
        style={{
          border: '1px solid var(--color-neutral-300)',
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <Mono size={13}>{operatingWallet}</Mono> &nbsp;Circle Agent Wallet
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
            ● Policy-controlled · daily cap {num(policy?.maxDaily ?? 0)} · per-tx cap{' '}
            {num(policy?.maxPayment ?? 0)}
          </div>
        </div>
        <Link href="/policy">
          <Button variant="ghost" compact>
            Edit policy
          </Button>
        </Link>
      </div>

      <Kicker style={{ marginBottom: 8 }}>Cost structure</Kicker>
      <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: '0 0 12px' }}>
        Category band for &ldquo;{ob.category}&rdquo;: {pct(band.floor * 100, 0)} –{' '}
        {pct(band.ceiling * 100, 0)} of price
      </p>
      <div className="riv-grid riv-grid-2" style={{ gap: 14, marginBottom: 10 }}>
        <Field label="Average price per request (USDC)">
          <TextInput
            value={ob.pricePerRequest}
            onChange={(v) => set('pricePerRequest', v)}
            tabular
            inputMode="decimal"
          />
        </Field>
        <Field label="Declared cost per request (USDC)">
          <TextInput
            value={ob.costPerRequest}
            onChange={(v) => set('costPerRequest', v)}
            tabular
            inputMode="decimal"
          />
        </Field>
      </div>
      <div style={{ fontSize: 13, marginBottom: 18 }}>
        = {pct(costPct, 1)} of price &nbsp;
        {inBand ? (
          <span style={{ color: 'var(--color-ok)' }}>✓ in band</span>
        ) : (
          <span style={{ color: 'var(--color-warn)' }}>
            ⚠ outside band — the band floor will be used and M capped at{' '}
            {num(M_CEILING.unverified, 2)}
          </span>
        )}
      </div>

      <div
        style={{
          border: '1px solid var(--color-neutral-300)',
          padding: '12px 16px',
          fontSize: 12.5,
          color: 'var(--color-neutral-700)',
          marginBottom: 24,
        }}
      >
        Operating-capacity factor M <strong>0.88</strong> · ceiling while costs are unverified{' '}
        <strong>{num(M_CEILING.partiallyObserved, 2)}</strong>
        <br />
        Route your own upstream purchases through Rivora-observable rails to lift this ceiling. A
        fully observed cost base removes it entirely.
      </div>

      <Kicker style={{ marginBottom: 10 }}>Terms</Kicker>
      <Stack gap={10} style={{ marginBottom: 24 }}>
        {TERMS.map((text, i) => (
          <CheckRow key={i} checked={ob.terms[i] ?? false} onToggle={() => toggleTerm(i)}>
            {text}
          </CheckRow>
        ))}
      </Stack>

      <ButtonRow>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          disabled={!allAccepted}
          onClick={() => {
            complete();
            router.push('/dashboard');
          }}
        >
          Complete registration
        </Button>
      </ButtonRow>
    </Blueprint>
  );
}
