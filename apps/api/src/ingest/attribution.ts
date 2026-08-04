/**
 * Worst-case attribution. PRD §11.7 items 4–5, backlog item 8.
 *
 * Circle Nanopayments settles net, in batches — a settlement figure can
 * arrive with no per-payer breakdown behind it. The diversity and
 * concentration factors are computed *from* that breakdown, so revenue
 * without one poses a question the formula has to answer somehow.
 *
 * The previous answer was the flattering one: unattributed revenue raised
 * the eligible base (and with it the limit) while contributing nothing to
 * concentration, as though money with no known source carried no
 * concentration risk. The honest answer is the opposite presumption: revenue
 * that cannot be attributed is priced as if it all came from one payer.
 *
 * That single rule needs no new knobs. Full attribution reproduces the old
 * numbers exactly; zero attribution collapses to one payer holding 100% —
 * HHI 10,000, largest share 100 — which drives the D and C signals to zero
 * and reduces the advance rate, precisely the degradation PRD §42.2
 * prescribes; partial attribution degrades continuously between the two.
 * Better data buys a better limit, and only better data does.
 */

export interface PayerSlice {
  /** Windowed revenue for one attributed payer. */
  revenue: number;
  /** Days inside the window on which this payer settled. */
  daysActive: number;
  excluded: boolean;
}

export interface AttributionStats {
  largestPayerPct: number;
  /** Herfindahl over percentage shares — the conventional 0–10,000 scale. */
  hhi: number;
  uniquePayers: number;
  repeatPayers: number;
  /** Share of eligible revenue with a known payer behind it. */
  attributedPct: number;
  /** Denominator the shares were computed over; per-payer rows reuse it so
   * their shares and these stats describe the same universe. */
  shareBase: number;
}

/** Below this the gap is float noise from six-decimal rounding, not a payer. */
const DUST = 0.01;

export function attributionStats(payers: PayerSlice[], eligible: number): AttributionStats {
  const included = payers.filter((payer) => !payer.excluded);
  const attributed = included.reduce((sum, payer) => sum + payer.revenue, 0);

  // Eligible revenue no payer row explains. Never negative: attribution
  // exceeding the eligible total is a data inconsistency, not a credit.
  const unknown = Math.max(0, eligible - attributed);
  const hasUnknown = unknown > DUST;
  const shareBase = attributed + (hasUnknown ? unknown : 0);

  const shares = included.map((payer) =>
    shareBase > 0 ? (payer.revenue / shareBase) * 100 : 0,
  );
  const unknownShare = hasUnknown && shareBase > 0 ? (unknown / shareBase) * 100 : 0;

  const largest = Math.max(0, ...shares, unknownShare);
  const herfindahl = [...shares, unknownShare].reduce((sum, share) => sum + share * share, 0);

  return {
    largestPayerPct: Math.round(largest * 100) / 100,
    hhi: Math.round(herfindahl),
    // The unknown mass is at least one payer. Counting it keeps breadth from
    // reading as zero customers when there is plainly revenue.
    uniquePayers: included.length + (hasUnknown ? 1 : 0),
    // Repeat behaviour is only observable where attribution exists.
    repeatPayers: included.filter((payer) => payer.daysActive > 1).length,
    attributedPct:
      shareBase > 0 ? Math.round((attributed / shareBase) * 10_000) / 100 : 100,
    shareBase,
  };
}
