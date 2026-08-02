import { barWidth } from '@rivora/core';
import type { CSSProperties, ReactNode } from 'react';

/**
 * The hairline-bordered bar with an accent fill.
 *
 * The system's only chart primitive: a drawn box, not a filled shape. Used for
 * utilization, drawn credit, reserve coverage, factor values, concentration and
 * every distribution on the LP and risk surfaces.
 */
export function Meter({
  ratio,
  height = 8,
  maxWidth,
  fill = 'var(--color-accent)',
  markers,
  style,
}: {
  /** 0–1. Values outside are clamped. */
  ratio: number;
  height?: number;
  maxWidth?: number;
  fill?: string;
  /** Dashed threshold lines, as 0–1 positions with optional labels. */
  markers?: Array<{ at: number; label?: string }>;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'relative',
        height,
        border: '1px solid var(--color-neutral-400)',
        maxWidth,
        ...style,
      }}
    >
      <div style={{ height: '100%', background: fill, width: barWidth(ratio) }} />
      {markers?.map((m) => (
        <div
          key={m.at}
          title={m.label}
          style={{
            position: 'absolute',
            top: -4,
            bottom: -4,
            left: barWidth(m.at),
            borderLeft: '1px dashed var(--color-neutral-600)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * A multi-segment bar. Used for the revenue waterfall, where the three shares
 * must read as one hundred percent of a single batch rather than three
 * unrelated bars.
 */
export function SegmentedMeter({
  segments,
  height = 10,
  style,
}: {
  segments: Array<{ ratio: number; fill: string; label?: string }>;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        height,
        border: '1px solid var(--color-neutral-400)',
        ...style,
      }}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          title={s.label}
          style={{ width: barWidth(s.ratio), background: s.fill }}
        />
      ))}
    </div>
  );
}

/**
 * Label · bar · value — the row shape that carries every distribution in the
 * product: factors, exclusion reasons, top payers, loan book, sector exposure,
 * score distribution.
 */
export function BarRow({
  label,
  ratio,
  value,
  trailing,
  leading,
  labelWidth = 200,
  valueWidth = 70,
  barMaxWidth = 280,
  fill,
}: {
  label: ReactNode;
  ratio: number;
  value?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  labelWidth?: number | string;
  valueWidth?: number | string;
  barMaxWidth?: number;
  fill?: string;
}) {
  const columns = [
    leading ? '28px' : null,
    typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth,
    value ? (typeof valueWidth === 'number' ? `${valueWidth}px` : valueWidth) : null,
    'minmax(0, 1fr)',
    trailing ? 'auto' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        alignItems: 'center',
        gap: 12,
        fontSize: 13,
      }}
    >
      {leading ? (
        <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-700)' }}>
          {leading}
        </span>
      ) : null}
      <span>{label}</span>
      {value ? (
        <span className="tabular" style={{ textAlign: 'right' }}>
          {value}
        </span>
      ) : null}
      <Meter ratio={ratio} height={9} maxWidth={barMaxWidth} fill={fill} />
      {trailing ? (
        <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'right' }}>
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

/** A labelled progress bar with a caption underneath. */
export function Progress({
  ratio,
  caption,
  height = 4,
}: {
  ratio: number;
  caption?: ReactNode;
  height?: number;
}) {
  return (
    <div>
      <Meter ratio={ratio} height={height} />
      {caption ? (
        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 3 }}>
          {caption}
        </div>
      ) : null}
    </div>
  );
}
