import type { ReactNode } from 'react';

export type CheckMark = 'pass' | 'fail' | 'warn' | 'pending' | 'todo';

const MARK: Record<CheckMark, { glyph: string; color: string }> = {
  pass: { glyph: '✓', color: 'var(--color-ok)' },
  fail: { glyph: '✕', color: 'var(--color-danger)' },
  warn: { glyph: '⚠', color: 'var(--color-warn)' },
  pending: { glyph: '⏱', color: 'var(--color-warn)' },
  todo: { glyph: '○', color: 'var(--color-neutral-500)' },
};

/**
 * A ✓/✕/⚠ line.
 *
 * Carries the draw preconditions, the onboarding verification log, the cure
 * steps, the automated response list and the closure conditions. The glyph is
 * always present — colour alone never carries the outcome (screens.md §13.4).
 */
export function CheckLine({
  mark,
  children,
  value,
  detail,
}: {
  mark: CheckMark;
  children: ReactNode;
  /** Right-aligned measured value, e.g. `104.2`. */
  value?: ReactNode;
  /** Small print under the label, e.g. `required ≥ 3.0`. */
  detail?: ReactNode;
}) {
  const m = MARK[mark];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
      <span>
        <span style={{ color: m.color }}>{m.glyph}</span> {children}
        {detail ? (
          <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', paddingLeft: 16 }}>
            {detail}
          </div>
        ) : null}
      </span>
      {value ? (
        <span className="tabular" style={{ whiteSpace: 'nowrap' }}>
          {value}
        </span>
      ) : null}
    </div>
  );
}

export function checkMarkFor(pass: boolean, severity: 'blocking' | 'advisory' = 'blocking') {
  if (pass) return 'pass' as const;
  return severity === 'advisory' ? ('warn' as const) : ('fail' as const);
}
