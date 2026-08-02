'use client';

import { useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  ButtonRow,
  CodeBlock,
  Field,
  Kicker,
  Select,
  Terminal,
  TerminalLine,
  TextInput,
} from '@rivora/ui';

/**
 * S-11 — Endpoint and binding verification. screens.md §7.2
 *
 * The most important onboarding step, and it should feel like it: the borrower
 * watches the protocol resolve their host, read the live 402 challenge and
 * compare the advertised `payTo` against the router. Everything downstream —
 * the advance rate, the anti-diversion controls, whether repayment is
 * structural at all — rests on this binding (PRD §11.4).
 */
export function StepEndpoint({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const ob = useProtocol((s) => s.onboarding);
  const set = useProtocol((s) => s.setOnboarding);
  const verify = useProtocol((s) => s.verifyEndpoint);

  const showLog = ob.verifyLog.length > 0 || ob.verifying;

  return (
    <Blueprint style={{ padding: '26px 30px' }}>
      <Kicker style={{ marginBottom: 12 }}>Revenue endpoint</Kicker>
      <Field label="Endpoint URL" style={{ marginBottom: 12 }}>
        <TextInput
          value={ob.endpoint}
          onChange={(v) => set('endpoint', v)}
          mono
          inputMode="url"
        />
      </Field>
      <Field label="Payment method" style={{ marginBottom: 24 }}>
        <Select value="x402" onChange={() => undefined} options={['x402 via Circle Nanopayments']} />
      </Field>

      <Kicker style={{ marginBottom: 8 }}>Prove you control this endpoint</Kicker>
      <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', margin: '0 0 12px' }}>
        Serve this nonce at the well-known path, or sign it with your endpoint&rsquo;s advertised
        payment key.
      </p>

      <CodeBlock
        aside={
          <Button variant="ghost" compact>
            Copy
          </Button>
        }
      >
        {`GET https://api.quotestream.dev/.well-known/rivora-challenge\nnonce: rv_9f4c2a71e08b3d55`}
      </CodeBlock>

      <div style={{ marginTop: 16 }}>
        <Button variant="primary" onClick={verify} disabled={ob.verifying}>
          {ob.verifying ? 'Verifying…' : 'Verify endpoint'}
        </Button>
      </div>

      {showLog ? (
        <div style={{ marginTop: 20 }}>
          <Kicker style={{ marginBottom: 8 }}>Verification log</Kicker>
          <Terminal cursor={ob.verifying}>
            {ob.verifyLog.map((line, i) => (
              <TerminalLine key={i} mark={line.mark}>
                {line.text}
              </TerminalLine>
            ))}
          </Terminal>
        </div>
      ) : null}

      <ButtonRow style={{ marginTop: 26 }}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" disabled={!ob.verified} onClick={onNext}>
          Continue
        </Button>
      </ButtonRow>
    </Blueprint>
  );
}
