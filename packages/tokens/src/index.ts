/**
 * Typed handles onto the CSS custom properties defined by the Industry design
 * system and the Rivora application layer.
 *
 * Components should reference these rather than writing `var(--color-…)`
 * string literals inline, so a renamed token fails at compile time instead of
 * silently rendering the CSS default.
 */

export const color = {
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  text: 'var(--color-text)',
  accent: 'var(--color-accent)',
  divider: 'var(--color-divider)',

  neutral100: 'var(--color-neutral-100)',
  neutral200: 'var(--color-neutral-200)',
  neutral300: 'var(--color-neutral-300)',
  neutral400: 'var(--color-neutral-400)',
  neutral500: 'var(--color-neutral-500)',
  neutral600: 'var(--color-neutral-600)',
  neutral700: 'var(--color-neutral-700)',
  neutral800: 'var(--color-neutral-800)',
  neutral900: 'var(--color-neutral-900)',

  accent100: 'var(--color-accent-100)',
  accent200: 'var(--color-accent-200)',
  accent300: 'var(--color-accent-300)',
  accent400: 'var(--color-accent-400)',
  accent500: 'var(--color-accent-500)',
  accent600: 'var(--color-accent-600)',
  accent700: 'var(--color-accent-700)',
  accent800: 'var(--color-accent-800)',
  accent900: 'var(--color-accent-900)',

  ok: 'var(--color-ok)',
  okBg: 'var(--color-ok-bg)',
  warn: 'var(--color-warn)',
  warnBg: 'var(--color-warn-bg)',
  warnInk: 'var(--color-warn-ink)',
  restrict: 'var(--color-restrict)',
  restrictBg: 'var(--color-restrict-bg)',
  restrictInk: 'var(--color-restrict-ink)',
  danger: 'var(--color-danger)',
  dangerBg: 'var(--color-danger-bg)',
  dangerInk: 'var(--color-danger-ink)',

  scrim: 'var(--color-scrim)',
} as const;

export const font = {
  heading: 'var(--font-heading)',
  body: 'var(--font-body)',
  mono: 'var(--font-mono)',
} as const;

export const measure = {
  wide: 'var(--measure-wide)',
  mid: 'var(--measure-mid)',
  narrow: 'var(--measure-narrow)',
  form: 'var(--measure-form)',
  tight: 'var(--measure-tight)',
} as const;

export const shadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
} as const;

export type ColorToken = keyof typeof color;
export type MeasureToken = keyof typeof measure;
