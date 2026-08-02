/**
 * Display formatting for the instants the API returns.
 *
 * The API speaks ISO-8601 UTC throughout. These render it for reading, and
 * always in UTC — a settlement timestamp shown in the reader's local zone
 * would disagree with the same instant on the block explorer, and reconciling
 * a repayment against a transaction is exactly what these are read for.
 */

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

const DAY_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const CLOCK = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/** `02 Aug` */
export function day(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? DAY.format(d) : '—';
}

/** `02 Aug 14:31` */
export function dayTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? DAY_TIME.format(d) : '—';
}

/** `14:31:07` */
export function clock(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? CLOCK.format(d) : '—';
}

const FULL = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/** `02 Aug 2026, 14:31 UTC` — for the timestamps that carry a year. */
export function fullTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${FULL.format(d)} UTC` : '—';
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
