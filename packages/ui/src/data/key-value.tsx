import type { CSSProperties, ReactNode } from 'react';

/**
 * Label left, value right.
 *
 * The single most repeated shape in the product — terms, capacity checks,
 * service health, rates, protection, position, factors, closure conditions.
 * Centralised so the label colour, the tabular alignment and the row rhythm
 * cannot drift between the borrower, LP and operator surfaces.
 */
export function KeyValue({
  label,
  value,
  detail,
  strong = false,
  divider = false,
  style,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Small print under the label, e.g. "required ≥ 3.0". */
  detail?: ReactNode;
  strong?: boolean;
  /** Draws a rule above the row — used for totals. */
  divider?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontWeight: strong ? 600 : undefined,
        borderTop: divider ? '1px solid var(--color-neutral-300)' : undefined,
        paddingTop: divider ? 6 : undefined,
        ...style,
      }}
    >
      <span style={{ color: strong ? undefined : 'var(--color-neutral-700)' }}>
        {label}
        {detail ? (
          <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{detail}</div>
        ) : null}
      </span>
      <span className="tabular" style={{ textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

/** A vertical stack of KeyValue rows at the standard rhythm. */
export function KeyValueList({
  children,
  gap = 6,
  size = 13,
  style,
}: {
  children: ReactNode;
  gap?: number;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'grid', gap, fontSize: size, marginTop: 8, ...style }}>{children}</div>
  );
}

/**
 * A bordered stat cell in a ruled grid — the treatment used on the public
 * reputation page, where the figures sit in a drawn table rather than cards.
 */
export function StatCell({
  label,
  value,
  borderRight = false,
  borderBottom = false,
}: {
  label: ReactNode;
  value: ReactNode;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  return (
    <div
      style={{
        padding: '14px 18px',
        borderRight: borderRight ? '1px solid var(--color-neutral-300)' : undefined,
        borderBottom: borderBottom ? '1px solid var(--color-neutral-300)' : undefined,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-neutral-600)',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

/** An unframed figure with a small uppercase label above it. */
export function Stat({
  label,
  value,
  caption,
  size = 20,
  style,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={style}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-neutral-600)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        {label}
      </div>
      <div
        className="tabular"
        style={{ fontSize: size, fontFamily: 'var(--font-heading)', fontWeight: 600, marginTop: 2 }}
      >
        {value}
      </div>
      {caption ? (
        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>{caption}</div>
      ) : null}
    </div>
  );
}
