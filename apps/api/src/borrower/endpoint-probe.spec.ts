import { describe, expect, it, vi } from 'vitest';

import { extractPayTo, probeEndpoint } from './endpoint-probe';

const ROUTER = '0xeefda804d1f8ce675479d3b935e34b2052863685';

/** A 402 challenge, as an x402 endpoint answers an unpaid request. */
function challenge(payTo: string, status = 402): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ accepts: [{ scheme: 'x402', asset: 'USDC', payTo }] }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('extractPayTo', () => {
  it('finds payTo wherever the challenge puts it', () => {
    expect(extractPayTo({ payTo: ROUTER })).toBe(ROUTER);
    expect(extractPayTo({ accepts: [{ payTo: ROUTER }] })).toBe(ROUTER);
    expect(extractPayTo({ a: { b: { pay_to: ROUTER } } })).toBe(ROUTER);
  });

  it('lowercases, so a checksummed address still matches', () => {
    expect(extractPayTo({ payTo: ROUTER.toUpperCase().replace('0X', '0x') })).toBe(ROUTER);
  });

  it('is null when there is no address to find', () => {
    expect(extractPayTo({ scheme: 'x402' })).toBeNull();
    expect(extractPayTo(null)).toBeNull();
    expect(extractPayTo({ payTo: 'not-an-address' })).toBeNull();
  });
});

/**
 * The URL is supplied by the borrower, so the probe is being asked to fetch
 * an address chosen from outside. These are the cases where it must refuse
 * before any request leaves the process.
 */
describe('refusing to be pointed inward', () => {
  const never = vi.fn(async () => new Response('', { status: 402 })) as unknown as typeof fetch;

  it('refuses loopback', async () => {
    const result = await probeEndpoint('https://localhost/api', ROUTER, never);

    expect(result.verified).toBe(false);
    expect(result.log.at(-1)!.text).toMatch(/private address/);
    expect(never).not.toHaveBeenCalled();
  });

  it('refuses the cloud metadata address', async () => {
    // 169.254.169.254 is credentials on most clouds. Without this the probe
    // is an exfiltration tool a borrower aims by registering a URL.
    const result = await probeEndpoint('https://169.254.169.254/latest/meta-data', ROUTER, never);

    expect(result.verified).toBe(false);
    expect(never).not.toHaveBeenCalled();
  });

  it('refuses plain HTTP', async () => {
    const result = await probeEndpoint('http://example.com/api', ROUTER, never);

    expect(result.verified).toBe(false);
    expect(result.log[0]!.text).toMatch(/must be HTTPS/);
    expect(never).not.toHaveBeenCalled();
  });

  it('refuses something that is not a URL', async () => {
    const result = await probeEndpoint('not a url', ROUTER, never);
    expect(result.verified).toBe(false);
  });
});

describe('probing a real endpoint', () => {
  it('verifies when the advertised payTo is the deployed router', async () => {
    const result = await probeEndpoint('https://example.com/api', ROUTER, challenge(ROUTER));

    expect(result.verified).toBe(true);
    expect(result.payTo).toBe(ROUTER);
    expect(result.log.some((s) => s.text.includes('402 Payment Required'))).toBe(true);
  });

  it('fails when the endpoint points payment somewhere else', async () => {
    // The whole reason the probe exists: revenue being quietly diverted.
    const diverted = '0x1111111111111111111111111111111111111111';
    const result = await probeEndpoint('https://example.com/api', ROUTER, challenge(diverted));

    expect(result.verified).toBe(false);
    expect(result.payTo).toBe(diverted);
    expect(result.log.at(-1)!.text).toMatch(/does NOT match/);
  });

  it('fails when the endpoint does not charge at all', async () => {
    const result = await probeEndpoint('https://example.com/api', ROUTER, challenge(ROUTER, 200));

    expect(result.verified).toBe(false);
    expect(result.log.at(-1)!.text).toMatch(/expected 402/);
  });

  it('fails, rather than throws, when the request dies', async () => {
    const broken = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const result = await probeEndpoint('https://example.com/api', ROUTER, broken);
    expect(result.verified).toBe(false);
    expect(result.log.at(-1)!.mark).toBe('✗');
  });

  it('does not verify when there is no router to compare against', async () => {
    // Reading a payTo proves the endpoint charges, not that it pays us.
    const result = await probeEndpoint('https://example.com/api', null, challenge(ROUTER));

    expect(result.verified).toBe(false);
    expect(result.payTo).toBe(ROUTER);
  });
});
