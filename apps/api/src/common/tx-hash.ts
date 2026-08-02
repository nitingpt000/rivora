/**
 * Deterministic transaction hashes.
 *
 * `Math.random()` would make every response differ, which breaks snapshot
 * diffing and makes a screenshot worthless as a record. A counter hashed into
 * hex looks the same to the eye and is reproducible — the same rule the
 * fixtures and the mock backend follow.
 *
 * These stand in for real transaction hashes until money actually moves
 * onchain; at that point the value comes from the chain and this goes away.
 */
export function deterministicTxHash(seq: number): string {
  const h = (seq * 2654435761) >>> 0;
  const a = h.toString(16).padStart(8, '0').slice(0, 4);
  const b = ((h ^ 0x9e3779b9) >>> 0).toString(16).padStart(8, '0').slice(0, 4);
  return `0x${a}…${b}`;
}

/** `14:31:02` — the UTC time-of-day form the activity stream displays. */
export function timeOfDay(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(at.getUTCHours())}:${p(at.getUTCMinutes())}:${p(at.getUTCSeconds())}`;
}

/** `12:47` — the shorter form used by alerts. */
export function shortTime(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(at.getUTCHours())}:${p(at.getUTCMinutes())}`;
}
