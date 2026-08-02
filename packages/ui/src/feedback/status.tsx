import { STATUS_COLOR, STATUS_GLYPH, TIER_COLOR } from '@rivora/core';
import type { BorrowerStatus, Tier } from '@rivora/core';
import type { ReactNode } from 'react';

/**
 * A borrower state, rendered with both a glyph and a colour.
 *
 * Never colour alone — screens.md §13.4. The glyph is what makes the state
 * legible in a screenshot, in print, and to a viewer with a colour deficiency.
 */
export function StatusPill({
  status,
  tier,
  score,
  size = 13,
}: {
  status: BorrowerStatus;
  tier?: Tier;
  score?: number;
  size?: number;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: size,
        letterSpacing: '0.08em',
        color: STATUS_COLOR[status],
      }}
    >
      {STATUS_GLYPH[status]} {tier ? `${tier} · ` : ''}
      {tier && score !== undefined ? `Score ${score}` : status}
    </span>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-heading)',
        letterSpacing: '0.08em',
        color: TIER_COLOR[tier],
      }}
    >
      ● {tier}
    </span>
  );
}

/**
 * A transaction hash chip.
 *
 * PRD §36 acceptance criterion 15 requires every financial action to show an
 * Arc transaction hash. Making it a component means no screen can quietly ship
 * a money movement without one.
 */
export function TxChip({
  hash,
  meta,
  children,
}: {
  hash: string;
  /** Block, finality, latency — shown after the hash where there is room. */
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <span className="mono" style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>
      ⧉ {hash}
      {meta ? (
        <span style={{ color: 'var(--color-neutral-700)', marginLeft: 8 }}>{meta}</span>
      ) : null}
      {children}
    </span>
  );
}
