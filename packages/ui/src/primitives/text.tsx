import type { CSSProperties, ReactNode } from 'react';

/**
 * The uppercase tracked label that heads every panel and stat.
 * Barlow Condensed, 0.14em tracking — the system's section voice.
 */
export function Kicker({
  children,
  style,
  as: Tag = 'div',
}: {
  children: ReactNode;
  style?: CSSProperties;
  as?: 'div' | 'span' | 'h2' | 'h3';
}) {
  return (
    <Tag className="kicker" style={style}>
      {children}
    </Tag>
  );
}

/** Addresses, hashes, request ids and machine output. */
export function Mono({
  children,
  size = 12,
  color,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span className="mono" style={{ fontSize: size, color, ...style }}>
      {children}
    </span>
  );
}

/** Muted supporting copy. */
export function Muted({
  children,
  size = 12.5,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span style={{ fontSize: size, color: 'var(--color-neutral-600)', ...style }}>{children}</span>
  );
}

/**
 * A disclosure note. Used for the privacy statements that sit under most
 * screens — "not disclosed", "never displayed here", "recorded for reporting".
 * Given its own component because screens.md treats these as required content,
 * not decoration.
 */
export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p
      style={{
        fontSize: 12,
        color: 'var(--color-neutral-600)',
        margin: '12px 0 0',
        maxWidth: '90ch',
        ...style,
      }}
    >
      {children}
    </p>
  );
}
