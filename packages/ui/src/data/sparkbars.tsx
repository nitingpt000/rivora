import type { CSSProperties, ReactNode } from 'react';

/**
 * The stacked daily-revenue column chart.
 *
 * Deliberately not a charting library: the design system draws figures as
 * hairline wireframe objects, and a 30-bar column chart is four divs. Pulling
 * in a chart dependency would cost more than it saves and would fight the
 * system's line-drawing idiom.
 */
export function Sparkbars({
  bars,
  height = 140,
  gap = 3,
  caption,
  legend,
  axis,
}: {
  /** Each bar's primary and optional secondary (stacked above) ratio, 0–1. */
  bars: Array<{ value: number; secondary?: number }>;
  height?: number;
  gap?: number;
  caption?: ReactNode;
  legend?: ReactNode;
  axis?: { left?: ReactNode; right?: ReactNode };
}) {
  const peak = Math.max(...bars.map((b) => b.value + (b.secondary ?? 0)), 1);

  return (
    <div>
      {legend ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            fontSize: 12,
            color: 'var(--color-neutral-600)',
            marginBottom: 8,
          }}
        >
          {legend}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap, height }}>
        {bars.map((b, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              height: '100%',
            }}
          >
            {b.secondary ? (
              <div
                style={{
                  background: 'var(--color-neutral-300)',
                  height: `${(b.secondary / peak) * 100}%`,
                }}
              />
            ) : null}
            <div
              style={{
                background: 'var(--color-accent)',
                height: `${(b.value / peak) * 100}%`,
              }}
            />
          </div>
        ))}
      </div>

      {(axis || caption) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 11,
            color: 'var(--color-neutral-600)',
            marginTop: 6,
          }}
        >
          <span>{axis?.left}</span>
          {caption ? <span>{caption}</span> : null}
          <span>{axis?.right}</span>
        </div>
      )}
    </div>
  );
}

/**
 * A horizontal threshold plot: a flat series drawn against dashed limit lines.
 * Used for the routed-coverage chart, where the thresholds are the point.
 */
export function ThresholdPlot({
  height = 44,
  seriesTopPct = 8,
  thresholds,
  axis,
}: {
  height?: number;
  /** Where the series sits, as a percentage from the top. */
  seriesTopPct?: number;
  thresholds: Array<{ atPct: number; label: string }>;
  axis?: { left?: ReactNode; right?: ReactNode };
}) {
  return (
    <div>
      <div
        style={{
          position: 'relative',
          height,
          borderBottom: '1px solid var(--color-neutral-400)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${seriesTopPct}%`,
            borderTop: '2px solid var(--color-accent)',
          }}
        />
        {thresholds.map((t) => (
          <div key={t.label}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${t.atPct}%`,
                borderTop: '1px dashed var(--color-neutral-500)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: 0,
                top: `calc(${t.atPct}% - 16px)`,
                fontSize: 10.5,
                color: 'var(--color-neutral-600)',
              }}
            >
              {t.label}
            </span>
          </div>
        ))}
      </div>
      {axis ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--color-neutral-600)',
            marginTop: 4,
          }}
        >
          <span>{axis.left}</span>
          <span>{axis.right}</span>
        </div>
      ) : null}
    </div>
  );
}

/** A step chart for the credit-limit history. */
export function StepChart({
  steps,
  height = 120,
  style,
}: {
  steps: Array<{ widthPct: number; heightPct: number; label?: ReactNode; axis?: ReactNode }>;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height,
          borderBottom: '1px solid var(--color-neutral-400)',
        }}
      >
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              width: `${s.widthPct}%`,
              height: `${s.heightPct}%`,
              borderTop: s.heightPct > 0 ? '2px solid var(--color-accent)' : undefined,
              position: 'relative',
            }}
          >
            {s.label ? (
              <span
                className="tabular"
                style={{ position: 'absolute', top: -20, left: 0, fontSize: 12 }}
              >
                {s.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 6 }}>
        {steps.map((s, i) => (
          <span key={i} style={{ width: `${s.widthPct}%` }}>
            {s.axis}
          </span>
        ))}
      </div>
    </div>
  );
}
