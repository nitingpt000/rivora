/**
 * x402 payment authorizations, verified.
 *
 * A buyer pays by signing an EIP-3009 `TransferWithAuthorization` — a
 * transferable instruction to move USDC — and attaching it to the retried
 * request. The seller checks the signature and serves the resource
 * immediately; Circle Gateway batches the authorizations and settles them
 * onchain afterwards.
 *
 * What that means for this file: the signature is the payment. Everything
 * here is the check that stands between "someone claims they paid" and
 * "someone paid", so each failure has its own reason rather than a shared
 * false.
 *
 * ## What this does not do
 *
 * Settle. Settlement is Gateway's, in batches, and a seller does not perform
 * it. A verified authorization is a cryptographic promise that the payer's
 * balance can be debited — strong enough to serve a sub-cent resource on,
 * which is the entire premise of nanopayments, and not the same thing as
 * money having moved.
 */

export interface PaymentAuthorization {
  from: string;
  to: string;
  /** USDC in 6-decimal integer units, as a decimal string. */
  value: string;
  /** Unix seconds; the authorization is not valid before this. */
  validAfter: string;
  /** Unix seconds; not valid after this. */
  validBefore: string;
  /** 32-byte hex, unique per authorization. The replay guard. */
  nonce: string;
  signature: string;
}

export interface VerificationContext {
  /** Where payment must be directed — the borrower's Revenue Router. */
  payTo: string;
  /** Minimum acceptable value, in 6-decimal units. */
  priceUnits: bigint;
  /** USDC contract, the EIP-712 verifying contract. */
  asset: string;
  chainId: number;
  /** EIP-712 domain name and version of the USDC contract. */
  domainName: string;
  domainVersion: string;
  /** Seconds. Now, injected so verification is testable without a clock. */
  now: number;
}

export type VerificationCode =
  | 'malformed'
  | 'wrong_recipient'
  | 'underpaid'
  | 'not_yet_valid'
  | 'expired'
  | 'bad_signature';

export type Verification =
  | { ok: true; payer: string; value: bigint }
  | { ok: false; code: VerificationCode; reason: string };

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX_32 = /^0x[0-9a-fA-F]{64}$/;

/**
 * `viem` is ESM-only and this app compiles to CommonJS, so it is loaded with
 * a dynamic import — the same treatment `siwe.ts` and `arc-chain.service.ts`
 * give it, for the same reason.
 */
type RecoverTypedData = (args: {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
  signature: `0x${string}`;
}) => Promise<string>;

let recoverPromise: Promise<RecoverTypedData> | null = null;

function recoverer(): Promise<RecoverTypedData> {
  recoverPromise ??= import('viem').then(
    (module) => module.recoverTypedDataAddress as unknown as RecoverTypedData,
  );
  return recoverPromise;
}

/** The EIP-3009 type, exactly as USDC defines it. */
const TRANSFER_WITH_AUTHORIZATION = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
];

export async function verifyPayment(
  auth: PaymentAuthorization,
  ctx: VerificationContext,
): Promise<Verification> {
  const bad = (code: VerificationCode, reason: string): Verification => ({ ok: false, code, reason });

  if (
    !HEX_ADDRESS.test(auth.from ?? '') ||
    !HEX_ADDRESS.test(auth.to ?? '') ||
    !HEX_32.test(auth.nonce ?? '') ||
    typeof auth.signature !== 'string' ||
    !auth.signature.startsWith('0x')
  ) {
    return bad('malformed', 'The authorization is missing fields or malformed.');
  }

  let value: bigint;
  let validAfter: bigint;
  let validBefore: bigint;
  try {
    value = BigInt(auth.value);
    validAfter = BigInt(auth.validAfter);
    validBefore = BigInt(auth.validBefore);
  } catch {
    return bad('malformed', 'value, validAfter and validBefore must be integers.');
  }

  // Checked before the signature: recovering a signature is the expensive
  // step, and an authorization addressed elsewhere is not ours to verify.
  if (auth.to.toLowerCase() !== ctx.payTo.toLowerCase()) {
    return bad('wrong_recipient', `Payment is addressed to ${auth.to}, not to ${ctx.payTo}.`);
  }

  if (value < ctx.priceUnits) {
    return bad(
      'underpaid',
      `Authorized ${formatUnits(value)} USDC, the resource costs ${formatUnits(ctx.priceUnits)}.`,
    );
  }

  const now = BigInt(ctx.now);
  if (validAfter > now) return bad('not_yet_valid', 'The authorization is not valid yet.');
  if (validBefore <= now) return bad('expired', 'The authorization has expired.');

  let signer: string;
  try {
    const recover = await recoverer();
    signer = await recover({
      domain: {
        name: ctx.domainName,
        version: ctx.domainVersion,
        chainId: ctx.chainId,
        verifyingContract: ctx.asset,
      },
      types: { TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: auth.from,
        to: auth.to,
        value,
        validAfter,
        validBefore,
        nonce: auth.nonce,
      },
      signature: auth.signature as `0x${string}`,
    });
  } catch {
    return bad('bad_signature', 'The signature could not be recovered.');
  }

  // The signature proves the payer authorised *this* transfer. A signature
  // that recovers to anyone else is somebody else's authorization replayed
  // with the `from` field rewritten.
  if (signer.toLowerCase() !== auth.from.toLowerCase()) {
    return bad('bad_signature', 'The signature does not belong to the stated payer.');
  }

  return { ok: true, payer: auth.from.toLowerCase(), value };
}

/** 6-decimal units to a human figure. Display only. */
export function formatUnits(units: bigint): string {
  const whole = units / 1_000_000n;
  const frac = (units % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * The challenge served with a 402.
 *
 * Shaped as x402 expects: a list of what the seller accepts, so a client can
 * pick a scheme rather than having one imposed.
 */
export function paymentChallenge(ctx: {
  payTo: string;
  priceUnits: bigint;
  asset: string;
  chainId: number;
  resource: string;
  description: string;
}) {
  return {
    x402Version: 1,
    error: 'payment_required',
    accepts: [
      {
        scheme: 'exact',
        network: `eip155:${ctx.chainId}`,
        resource: ctx.resource,
        description: ctx.description,
        asset: ctx.asset,
        assetDecimals: 6,
        maxAmountRequired: ctx.priceUnits.toString(),
        payTo: ctx.payTo,
        maxTimeoutSeconds: 300,
      },
    ],
  };
}
