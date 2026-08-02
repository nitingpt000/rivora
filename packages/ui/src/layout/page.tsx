import type { CSSProperties, ReactNode } from 'react';

import { Blueprint } from '../primitives/blueprint';
import { Kicker } from '../primitives/text';

export type Measure = 'wide' | 'mid' | 'narrow' | 'form' | 'tight';

const MEASURE: Record<Measure, string> = {
  wide: 'var(--measure-wide)',
  mid: 'var(--measure-mid)',
  narrow: 'var(--measure-narrow)',
  form: 'var(--measure-form)',
  tight: 'var(--measure-tight)',
};

/**
 * The page container.
 *
 * Every screen is laid out on one of five measures. Encoding them here means a
 * screen cannot invent its own width, which is what keeps the modular grid
 * reading as one system across 41 of them.
 */
export function Page({
  measure = 'wide',
  children,
  paddingTop = 28,
  style,
}: {
  measure?: Measure;
  children: ReactNode;
  paddingTop?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        maxWidth: MEASURE[measure],
        margin: '0 auto',
        padding: `${paddingTop}px var(--gutter) 80px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Title left, status or meta right. */
export function PageHeader({
  title,
  aside,
  eyebrow,
  lead,
  back,
  size = 30,
}: {
  title: ReactNode;
  aside?: ReactNode;
  eyebrow?: ReactNode;
  /** Supporting sentence under the title. */
  lead?: ReactNode;
  /** A back link rendered above the title. */
  back?: ReactNode;
  size?: number;
}) {
  return (
    <header style={{ marginBottom: 18 }}>
      {back ? <div style={{ fontSize: 12.5, marginBottom: 8 }}>{back}</div> : null}
      {eyebrow ? (
        <Kicker style={{ color: 'var(--color-accent-700)', marginBottom: 6 }}>{eyebrow}</Kicker>
      ) : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: size,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {aside}
      </div>
      {lead ? (
        <p style={{ color: 'var(--color-neutral-700)', fontSize: 14, margin: '6px 0 0' }}>{lead}</p>
      ) : null}
    </header>
  );
}

/**
 * A framed panel with a kicker head — the workhorse container.
 *
 * `aside` sits opposite the kicker and carries the panel's own link or control,
 * which is where most cross-screen navigation lives.
 */
export function Section({
  title,
  aside,
  children,
  footer,
  padding = '20px 26px',
  borderColor,
  background,
  style,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  padding?: CSSProperties['padding'];
  borderColor?: string;
  background?: string;
  style?: CSSProperties;
}) {
  return (
    <Blueprint borderColor={borderColor} background={background} style={{ ...style }}>
      <div style={{ padding }}>
        {(title || aside) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
              marginBottom: 12,
            }}
          >
            {title ? <Kicker>{title}</Kicker> : <span />}
            {aside}
          </div>
        )}
        {children}
      </div>
      {footer ? (
        <div
          style={{
            padding: '12px 26px',
            borderTop: '1px solid var(--color-neutral-300)',
            fontSize: 12.5,
            color: 'var(--color-neutral-700)',
          }}
        >
          {footer}
        </div>
      ) : null}
    </Blueprint>
  );
}

/** The responsive grid from screens.md §13.3. */
export function Grid({
  cols = 2,
  children,
  gap = 14,
  style,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div className={`riv-grid riv-grid-${cols}`} style={{ gap, ...style }}>
      {children}
    </div>
  );
}

/** Vertical rhythm between stacked blocks. */
export function Stack({
  children,
  gap = 14,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) {
  return <div style={{ display: 'grid', gap, ...style }}>{children}</div>;
}
