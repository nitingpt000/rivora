import type { ReactNode } from 'react';

/**
 * The reversed machine-output block: accent-900 ground, paper type, monospace.
 *
 * DESIGN-SYSTEM.md permits the accent's deep step to carry a full field where
 * the deck's dividers use it. This is that field, reserved for output the
 * protocol produced rather than copy a human wrote — the endpoint verification
 * log and the score-API response.
 */
export function Terminal({
  children,
  minHeight = 64,
  cursor = false,
}: {
  children: ReactNode;
  minHeight?: number;
  /** A blinking block cursor while output is still streaming. */
  cursor?: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--color-neutral-400)',
        background: 'var(--color-accent-900)',
        color: 'var(--color-accent-100)',
        padding: '14px 18px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        lineHeight: 1.75,
        minHeight,
        overflowX: 'auto',
      }}
    >
      {children}
      {cursor ? <div className="riv-pulse">▍</div> : null}
    </div>
  );
}

/** One line of terminal output, with its result mark right-aligned. */
export function TerminalLine({ children, mark }: { children: ReactNode; mark?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{children}</span>
      {mark ? <span>{mark}</span> : null}
    </div>
  );
}

/** A light-ground code block, for challenges and payloads the user copies. */
export function CodeBlock({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-neutral-300)',
        background: 'var(--color-neutral-100)',
        padding: '12px 16px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        whiteSpace: 'pre-wrap',
      }}
    >
      <span>{children}</span>
      {aside ? <span style={{ alignSelf: 'center' }}>{aside}</span> : null}
    </div>
  );
}
