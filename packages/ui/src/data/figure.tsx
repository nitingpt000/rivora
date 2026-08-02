import { delta as fmtDelta, num, pct as fmtPct, usdc } from '@rivora/core';
import type { CSSProperties, ReactNode } from 'react';

/**
 * A financial figure. Always tabular, always two decimals, never inline-styled
 * by the caller for alignment — screens.md §13.4.
 */
export function Money({
  value,
  size = 'md',
  suffix = 'USDC',
  sign,
  style,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Pass `null` to omit the ticker. */
  suffix?: string | null;
  /** Prefix a `−` for deductions in a running ledger. */
  sign?: '−' | '+';
  style?: CSSProperties;
}) {
  const sizes: Record<string, { font: number; suffix: number; heading: boolean }> = {
    sm: { font: 13, suffix: 11, heading: false },
    md: { font: 20, suffix: 12, heading: true },
    lg: { font: 28, suffix: 13, heading: true },
    xl: { font: 32, suffix: 14, heading: true },
  };
  const s = sizes[size] ?? sizes.md!;

  return (
    <span
      className="tabular"
      style={{
        fontFamily: s.heading ? 'var(--font-heading)' : undefined,
        fontWeight: s.heading ? 600 : undefined,
        fontSize: s.font,
        ...style,
      }}
    >
      {sign ? `${sign} ` : ''}
      {usdc(value)}
      {suffix ? (
        <span style={{ fontSize: s.suffix, fontWeight: 400 }}> {suffix}</span>
      ) : null}
    </span>
  );
}

/** A non-currency figure: counts, ratios, factors. */
export function Figure({
  value,
  decimals = 2,
  size = 'md',
  suffix,
  color,
  style,
}: {
  value: number | string;
  decimals?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  suffix?: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  const sizes: Record<string, number> = { sm: 13, md: 20, lg: 28, xl: 32 };
  const font = sizes[size] ?? 20;
  const text = typeof value === 'number' ? num(value, decimals) : value;

  return (
    <span
      className="tabular"
      style={{
        fontFamily: size === 'sm' ? undefined : 'var(--font-heading)',
        fontWeight: size === 'sm' ? undefined : 600,
        fontSize: font,
        color,
        ...style,
      }}
    >
      {text}
      {suffix ? <span style={{ fontSize: font * 0.5, fontWeight: 400 }}> {suffix}</span> : null}
    </span>
  );
}

/** A percentage. `value` is already in percent. */
export function Percent({
  value,
  decimals = 2,
  size = 'md',
  color,
}: {
  value: number;
  decimals?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}) {
  return <Figure value={fmtPct(value, decimals)} size={size} color={color} />;
}

/**
 * A signed delta with a direction glyph and a semantic colour.
 *
 * The glyph is not optional: screens.md §13.4 requires deltas to be readable
 * without colour vision, so ▲/▼ carries the direction and colour reinforces it.
 */
export function Delta({
  value,
  decimals = 0,
  suffix = '',
  style,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: CSSProperties;
}) {
  const color =
    value > 0 ? 'var(--color-ok)' : value < 0 ? 'var(--color-danger)' : 'var(--color-neutral-600)';
  return (
    <span className="tabular" style={{ color, ...style }}>
      {fmtDelta(value, decimals)}
      {suffix}
    </span>
  );
}
