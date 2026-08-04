import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * The endpoint binding probe. PRD §11.4.
 *
 * A borrower's credit rests on revenue arriving at a router the protocol can
 * see. That holds only while the paid endpoint actually advertises that
 * router as its `payTo` — so the protocol checks, rather than believing the
 * borrower.
 *
 * This used to return `verified: true` unconditionally beside a hardcoded
 * seven-line log describing checks that never ran. A probe that always
 * passes is worse than none: it gates credit on a claim, while reading like
 * evidence.
 *
 * ## The URL comes from the borrower
 *
 * Which makes this a server-side request forgery surface: the API is being
 * asked to fetch an address chosen by someone outside it. Every private
 * range is refused, redirects are not followed, and the whole thing runs
 * under a timeout — an endpoint that hangs must not hold a request open.
 */

export interface ProbeStep {
  text: string;
  mark: string;
}

export interface ProbeResult {
  verified: boolean;
  /** The `payTo` the endpoint advertised, lowercased. Null when unreadable. */
  payTo: string | null;
  log: ProbeStep[];
}

/** How long the whole probe may take. An endpoint slower than this is down. */
const TIMEOUT_MS = 5_000;

const PASS = '✓';
const FAIL = '✗';
const NOTE = '';

/**
 * Ranges a borrower's endpoint may never resolve to.
 *
 * Loopback, link-local, and the three private IPv4 blocks, plus IPv6
 * loopback and unique-local. Without this, `http://169.254.169.254/` is a
 * cloud metadata endpoint and the probe is a credential exfiltration tool.
 */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const v6 = address.toLowerCase();
    return v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
  }

  const [a, b] = address.split('.').map(Number);
  if (a === undefined || b === undefined) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/**
 * Reads the `payTo` out of an x402 challenge.
 *
 * The shape is not fully standardised across implementations, so this looks
 * for the field rather than insisting on a schema — a probe that fails
 * because a payer put `payTo` one level deeper would be reporting on its own
 * parser, not on the borrower.
 */
export function extractPayTo(body: unknown): string | null {
  if (typeof body === 'string') {
    const match = /0x[0-9a-fA-F]{40}/.exec(body);
    return match ? match[0].toLowerCase() : null;
  }

  if (!body || typeof body !== 'object') return null;

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (/^pay_?to$/i.test(key) && typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) {
      return value.toLowerCase();
    }
    if (value && typeof value === 'object') {
      const nested = extractPayTo(value);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * Probes a paid endpoint and reports what it found, step by step.
 *
 * Never throws. Every failure becomes a `✗` line, because the log is what the
 * borrower acts on — an exception would tell them only that something went
 * wrong somewhere.
 */
export async function probeEndpoint(
  endpoint: string,
  expectedPayTo: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeResult> {
  const log: ProbeStep[] = [];
  const fail = (text: string): ProbeResult => {
    log.push({ text, mark: FAIL });
    return { verified: false, payTo: null, log };
  };

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return fail(`"${endpoint}" is not a URL`);
  }

  if (url.protocol !== 'https:') {
    return fail(`${url.protocol.replace(':', '')} is not accepted — the endpoint must be HTTPS`);
  }

  // Resolved before the request so a private address is refused rather than
  // fetched. A hostname that resolves inside the network is the whole risk.
  let address: string;
  try {
    const resolved = await lookup(url.hostname);
    address = resolved.address;
  } catch {
    return fail(`${url.hostname} does not resolve`);
  }

  if (isPrivateAddress(address)) {
    return fail(`${url.hostname} resolves to ${address}, a private address`);
  }
  log.push({ text: `Resolving ${url.hostname} → ${address}`, mark: PASS });

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
  } catch (cause) {
    const reason = cause instanceof Error && cause.name === 'TimeoutError' ? 'timed out' : 'failed';
    return fail(`Request ${reason} after ${TIMEOUT_MS / 1000}s`);
  }

  log.push({ text: 'TLS handshake completed', mark: PASS });

  if (response.status !== 402) {
    return fail(`GET (unpaid) → ${response.status}, expected 402 Payment Required`);
  }
  log.push({ text: 'GET (unpaid) → 402 Payment Required', mark: PASS });

  const body: unknown = await response.json().catch(() => response.text().catch(() => null));
  const payTo = extractPayTo(body);

  if (!payTo) {
    return fail('The 402 challenge advertises no payTo address');
  }
  log.push({ text: 'scheme x402/nanopayment · asset USDC · Arc', mark: NOTE });

  if (!expectedPayTo) {
    log.push({ text: `payTo ${payTo} — no router deployed to compare against`, mark: '⚠' });
    return { verified: false, payTo, log };
  }

  const matches = payTo === expectedPayTo.toLowerCase();
  log.push({
    text: matches
      ? `payTo ${payTo} — matches the deployed router`
      : `payTo ${payTo} — does NOT match the router ${expectedPayTo.toLowerCase()}`,
    mark: matches ? PASS : FAIL,
  });

  return { verified: matches, payTo, log };
}
