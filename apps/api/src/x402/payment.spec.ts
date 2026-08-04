import { beforeAll, describe, expect, it } from 'vitest';

import { paymentChallenge, verifyPayment, type PaymentAuthorization } from './payment';

/**
 * `viem` is ESM-only and this app compiles to CommonJS, so the signer is
 * loaded dynamically here exactly as the source does it.
 */
type Signer = {
  address: `0x${string}`;
  signTypedData: (args: Record<string, unknown>) => Promise<`0x${string}`>;
};

/**
 * The signature is the payment, so these are the checks standing between
 * "someone claims they paid" and "someone paid". Signed for real with a test
 * key — a mocked signature would prove nothing about the thing most worth
 * proving.
 */
let PAYER: Signer;

beforeAll(async () => {
  const { privateKeyToAccount } = await import('viem/accounts');
  PAYER = privateKeyToAccount(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  ) as unknown as Signer;
});
const ROUTER = '0xeefda804d1f8ce675479d3b935e34b2052863685';
const USDC = '0x3600000000000000000000000000000000000000';
const CHAIN_ID = 5042002;
const NOW = 1_800_000_000;

const ctx = {
  payTo: ROUTER,
  priceUnits: 40_000n,
  asset: USDC,
  chainId: CHAIN_ID,
  domainName: 'USD Coin',
  domainVersion: '2',
  now: NOW,
};

/** Signs a real EIP-3009 authorization, as a paying agent would. */
async function authorize(overrides: Partial<PaymentAuthorization> = {}) {
  const message = {
    from: PAYER.address,
    to: ROUTER as `0x${string}`,
    value: 40_000n,
    validAfter: BigInt(NOW - 60),
    validBefore: BigInt(NOW + 300),
    nonce: `0x${'11'.repeat(32)}` as `0x${string}`,
  };

  const signature = await PAYER.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: CHAIN_ID,
      verifyingContract: USDC as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message,
  });

  return {
    from: message.from,
    to: message.to,
    value: message.value.toString(),
    validAfter: message.validAfter.toString(),
    validBefore: message.validBefore.toString(),
    nonce: message.nonce,
    signature,
    ...overrides,
  } as PaymentAuthorization;
}

describe('a genuine payment', () => {
  it('verifies, and reports who paid what', async () => {
    const result = await verifyPayment(await authorize(), ctx);

    expect(result).toMatchObject({ ok: true, value: 40_000n });
    if (result.ok) expect(result.payer).toBe(PAYER.address.toLowerCase());
  });

  it('accepts an overpayment', async () => {
    // Paying more than asked is the payer's business, not a refusal.
    const generous = await authorize();
    const result = await verifyPayment(generous, { ...ctx, priceUnits: 10_000n });
    expect(result.ok).toBe(true);
  });
});

describe('refusals', () => {
  it('refuses a payment addressed somewhere else', async () => {
    // The signature is valid — for a transfer to another seller entirely.
    const result = await verifyPayment(await authorize(), {
      ...ctx,
      payTo: '0x1111111111111111111111111111111111111111',
    });

    expect(result).toMatchObject({ ok: false, code: 'wrong_recipient' });
  });

  it('refuses an underpayment', async () => {
    const result = await verifyPayment(await authorize(), { ...ctx, priceUnits: 90_000n });
    expect(result).toMatchObject({ ok: false, code: 'underpaid' });
  });

  it('refuses an expired authorization', async () => {
    const result = await verifyPayment(await authorize(), { ...ctx, now: NOW + 3_600 });
    expect(result).toMatchObject({ ok: false, code: 'expired' });
  });

  it('refuses one that is not valid yet', async () => {
    const result = await verifyPayment(await authorize(), { ...ctx, now: NOW - 3_600 });
    expect(result).toMatchObject({ ok: false, code: 'not_yet_valid' });
  });

  /**
   * The attack this exists to stop: take somebody else's valid
   * authorization, rewrite `from` to your own address, and present it.
   * The recovered signer no longer matches the claimed payer.
   */
  it('refuses an authorization whose payer was rewritten', async () => {
    const stolen = await authorize({ from: '0x2222222222222222222222222222222222222222' });
    const result = await verifyPayment(stolen, ctx);

    expect(result).toMatchObject({ ok: false, code: 'bad_signature' });
  });

  it('refuses when the amount was tampered with after signing', async () => {
    // Raising `value` post-hoc changes the signed digest, so recovery lands
    // on a different address than the one claimed.
    const tampered = await authorize({ value: '9999999' });
    const result = await verifyPayment(tampered, ctx);

    expect(result).toMatchObject({ ok: false, code: 'bad_signature' });
  });

  it('refuses a signature from the wrong chain', async () => {
    const result = await verifyPayment(await authorize(), { ...ctx, chainId: 1 });
    expect(result).toMatchObject({ ok: false, code: 'bad_signature' });
  });

  it('refuses garbage without trying to recover it', async () => {
    const result = await verifyPayment(
      { from: 'nope', to: ROUTER, value: '1', validAfter: '0', validBefore: '1', nonce: 'x', signature: '' },
      ctx,
    );
    expect(result).toMatchObject({ ok: false, code: 'malformed' });
  });
});

describe('the challenge', () => {
  it('names the price, the asset and where to pay', () => {
    const challenge = paymentChallenge({
      payTo: ROUTER,
      priceUnits: 40_000n,
      asset: USDC,
      chainId: CHAIN_ID,
      resource: '/x402/quote',
      description: 'one quote',
    });

    expect(challenge.x402Version).toBe(1);
    expect(challenge.accepts[0]).toMatchObject({
      payTo: ROUTER,
      asset: USDC,
      maxAmountRequired: '40000',
      network: `eip155:${CHAIN_ID}`,
    });
  });
});
