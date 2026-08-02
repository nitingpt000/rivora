/**
 * Number and identifier formatting.
 *
 * screens.md §13.4 fixes the conventions: currency always two decimals with
 * thousands separators, rates and utilization two decimals, factors one or
 * two, deltas always signed with a direction glyph, addresses truncated 6+4.
 * Every screen goes through these so the conventions cannot drift.
 */

const usdcFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** A USDC amount: `13,500.00`. Never includes the ticker — callers add it. */
export function usdc(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return usdcFormatter.format(value);
}

/** A number at a chosen precision, with thousands separators. */
export function num(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** A percentage from a already-percent value: `pct(33.88)` → `33.88%`. */
export function pct(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${num(value, decimals)}%`;
}

/** A percentage from a ratio: `ratioPct(0.3388)` → `33.88%`. */
export function ratioPct(ratio: number, decimals = 2): string {
  return pct(ratio * 100, decimals);
}

/** A factor value: `0.95`. */
export function factor(value: number, decimals = 2): string {
  return num(value, decimals);
}

/**
 * A signed delta with a direction glyph. Colour alone never carries the
 * meaning — screens.md §13.4.
 */
export function delta(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const glyph = value > 0 ? '▲' : value < 0 ? '▼' : '';
  const magnitude = num(Math.abs(value), decimals);
  return glyph ? `${glyph}${magnitude}` : magnitude;
}

/** A signed percentage delta: `+35%` / `−22%`. Uses a true minus sign. */
export function signedPct(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${num(Math.abs(value), decimals)}%`;
}

/** Truncates an address to `0x9c4e…a7f1`. Already-truncated input passes through. */
export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (address.includes('…')) return address;
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** A duration in days, rendered as words rather than a bare number. */
export function days(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  const whole = Math.ceil(value);
  return whole === 1 ? '1 day' : `${whole} days`;
}

/** A bar width as a clamped CSS percentage string. */
export function barWidth(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.max(0, Math.min(100, ratio * 100))}%`;
}

/** A bar width from an already-percent value. */
export function barWidthPct(value: number): string {
  return barWidth(value / 100);
}
