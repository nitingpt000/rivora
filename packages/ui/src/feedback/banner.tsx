import { SEVERITY_BG, SEVERITY_COLOR, SEVERITY_GLYPH, SEVERITY_INK } from '@rivora/core';
import type { Severity } from '@rivora/core';
import type { ReactNode } from 'react';

/**
 * The alert banner that sits above page content whenever a borrower is not in a
 * clean state, or a protocol threshold is breached.
 *
 * screens.md §5.2 makes this required chrome rather than an optional flourish:
 * a borrower in WATCH must be told what changed, what it costs them, and what
 * returns them to ACTIVE — on every screen, not just the one that detected it.
 */
export function Banner({
  severity,
  title,
  children,
  actions,
  meta,
  emphasis = false,
}: {
  severity: Severity;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  /** A heavier border for the states that stop the borrower working. */
  emphasis?: boolean;
}) {
  return (
    <div
      role={severity === 'danger' || severity === 'restrict' ? 'alert' : 'status'}
      style={{
        border: `${emphasis ? 2 : 1}px solid ${SEVERITY_COLOR[severity]}`,
        background: SEVERITY_BG[severity],
        padding: '14px 20px',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.06em',
          color: SEVERITY_INK[severity],
          fontSize: emphasis ? 15 : 14,
        }}
      >
        {SEVERITY_GLYPH[severity]} {title}
      </div>
      {children ? (
        <div style={{ fontSize: 13, color: 'var(--color-neutral-800)', marginTop: 4 }}>
          {children}
        </div>
      ) : null}
      {meta ? (
        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 4 }}>{meta}</div>
      ) : null}
      {actions ? <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>{actions}</div> : null}
    </div>
  );
}

/** A quieter inline callout used for disclosures inside a panel. */
export function Callout({
  severity = 'info',
  children,
}: {
  severity?: Severity;
  children: ReactNode;
}) {
  const bordered = severity !== 'info';
  return (
    <div
      style={{
        border: `1px solid ${bordered ? SEVERITY_COLOR[severity] : 'var(--color-neutral-400)'}`,
        background: bordered ? SEVERITY_BG[severity] : undefined,
        padding: '10px 14px',
        fontSize: 12.5,
        color: 'var(--color-neutral-700)',
        marginTop: 14,
      }}
    >
      {bordered ? `${SEVERITY_GLYPH[severity]} ` : ''}
      {children}
    </div>
  );
}
