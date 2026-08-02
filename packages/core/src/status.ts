import type { BorrowerStatus, Tier } from './types';

/** Which token a status renders in. Never colour alone — see `statusGlyph`. */
export const STATUS_COLOR: Record<BorrowerStatus, string> = {
  OBSERVATION: 'var(--color-neutral-600)',
  ELIGIBLE: 'var(--color-accent-700)',
  ACTIVE: 'var(--color-ok)',
  WATCH: 'var(--color-warn)',
  RESTRICTED: 'var(--color-restrict)',
  DELINQUENT: 'var(--color-danger)',
  DEFAULTED: 'var(--color-danger)',
  REPAID: 'var(--color-ok)',
};

/**
 * Every status carries a glyph as well as a colour. screens.md §13.4 — a state
 * must be readable without colour vision.
 */
export const STATUS_GLYPH: Record<BorrowerStatus, string> = {
  OBSERVATION: '○',
  ELIGIBLE: '●',
  ACTIVE: '●',
  WATCH: '⚠',
  RESTRICTED: '⛔',
  DELINQUENT: '⛔',
  DEFAULTED: '⛔',
  REPAID: '✓',
};

export const TIER_COLOR: Record<Tier, string> = {
  Prime: 'var(--color-ok)',
  Strong: 'var(--color-ok)',
  Standard: 'var(--color-accent-700)',
  Restricted: 'var(--color-restrict)',
  Ineligible: 'var(--color-danger)',
};

/** Statuses from which a borrower may draw, given available credit. */
const BORROWABLE: ReadonlySet<BorrowerStatus> = new Set<BorrowerStatus>([
  'ACTIVE',
  'ELIGIBLE',
  'REPAID',
]);

export function canBorrow(status: BorrowerStatus, available: number): boolean {
  return BORROWABLE.has(status) && available > 0;
}

/** Statuses that render an alert banner above page content. screens.md §5.2. */
export function needsBanner(status: BorrowerStatus): boolean {
  return !['ACTIVE', 'ELIGIBLE', 'REPAID', 'OBSERVATION'].includes(status);
}

export type Severity = 'ok' | 'info' | 'warn' | 'restrict' | 'danger';

export const SEVERITY_GLYPH: Record<Severity, string> = {
  ok: '✓',
  info: 'ⓘ',
  warn: '⚠',
  restrict: '⛔',
  danger: '⛔',
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  ok: 'var(--color-ok)',
  info: 'var(--color-neutral-700)',
  warn: 'var(--color-warn)',
  restrict: 'var(--color-restrict)',
  danger: 'var(--color-danger)',
};

export const SEVERITY_BG: Record<Severity, string> = {
  ok: 'var(--color-ok-bg)',
  info: 'transparent',
  warn: 'var(--color-warn-bg)',
  restrict: 'var(--color-restrict-bg)',
  danger: 'var(--color-danger-bg)',
};

export const SEVERITY_INK: Record<Severity, string> = {
  ok: 'var(--color-ok)',
  info: 'var(--color-neutral-800)',
  warn: 'var(--color-warn-ink)',
  restrict: 'var(--color-restrict-ink)',
  danger: 'var(--color-danger-ink)',
};

export function severityForStatus(status: BorrowerStatus): Severity {
  switch (status) {
    case 'WATCH':
      return 'warn';
    case 'RESTRICTED':
      return 'restrict';
    case 'DELINQUENT':
    case 'DEFAULTED':
      return 'danger';
    default:
      return 'ok';
  }
}
