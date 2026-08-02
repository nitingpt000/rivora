'use client';

import { useProtocol } from '@rivora/protocol-sim';
import {
  Blueprint,
  Button,
  CheckLine,
  Kicker,
  Page,
  PageHeader,
  Section,
  Stack,
  Tag,
  Terminal,
} from '@rivora/ui';
import { useEffect } from 'react';

/** S-61 — Score API sandbox. screens.md §11.2 */
export default function SandboxPage() {
  const profiles = useProtocol((s) => s.sandboxProfiles);
  const selection = useProtocol((s) => s.sandboxSelection);
  const result = useProtocol((s) => s.sandboxResult);
  const pending = useProtocol((s) => s.pending);
  const error = useProtocol((s) => s.mutationError);
  const select = useProtocol((s) => s.selectSandbox);
  const send = useProtocol((s) => s.sendSandbox);
  const loadSandbox = useProtocol((s) => s.loadSandbox);

  useEffect(() => {
    void loadSandbox();
  }, [loadSandbox]);

  const profile = profiles?.find((p) => p.id === selection);

  const request = JSON.stringify(
    { endpoint: profile?.endpoint ?? '', window: 30 },
    null,
    2,
  );

  // The real response, from the real underwriter. `sandbox: true` and the
  // absence of a signature are part of what an integrator needs to see.
  const response = result ? JSON.stringify(result, null, 2) : '';

  return (
    <Page measure="form">
      <PageHeader
        title="Score API sandbox"
        aside={<Tag tone="neutral">Synthetic borrowers only</Tag>}
      />

      <Section
        title="Request"
        aside={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" compact>
              Copy as cURL
            </Button>
            <Button variant="primary" onClick={() => void send()} disabled={pending || !profile}>
              {pending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        }
        style={{ marginBottom: 14 }}
      >
        <Terminal minHeight={0}>
          <div>POST /v1/underwriting/score</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{request}</pre>
        </Terminal>
      </Section>

      {error ? (
        <Section title="Response" style={{ marginBottom: 14 }}>
          <Terminal minHeight={0}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>
          </Terminal>
        </Section>
      ) : null}

      {result ? (
        <Section
          title="Response"
          aside={<span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>200 OK</span>}
          style={{ marginBottom: 14 }}
        >
          <Terminal minHeight={0}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{response}</pre>
          </Terminal>
          <div style={{ marginTop: 10, fontSize: 13 }}>
            <CheckLine mark="warn">
              Sandbox response — unsigned, and not replayable as an attestation.
            </CheckLine>
          </div>
        </Section>
      ) : null}

      <Section title="Synthetic borrowers">
        <Stack gap={8}>
          {(profiles ?? []).map((b) => {
            const selected = b.id === selection;
            return (
              <Blueprint
                key={b.id}
                onClick={() => select(b.id)}
                label={`Select synthetic borrower ${b.id}`}
                borderColor={selected ? 'var(--color-accent)' : 'var(--color-neutral-300)'}
                background={selected ? 'var(--color-accent-100)' : undefined}
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span className="mono">/synthetic/{b.id}</span>
                <span style={{ flex: 1 }}>{b.description}</span>
                {selected ? <Kicker style={{ fontSize: 11 }}>◄ selected</Kicker> : null}
              </Blueprint>
            );
          })}
        </Stack>
      </Section>
    </Page>
  );
}
