import { ARC_CHAIN_ID } from './chain';

/**
 * Builds the EIP-4361 message the wallet signs.
 *
 * Every field is a binding the API checks, not decoration:
 *
 *  - `domain` and `uri` tie the signature to this site, so one harvested by
 *    another origin cannot be replayed against Rivora.
 *  - `Chain ID` must match the network the API runs on.
 *  - `Nonce` comes from `/auth/nonce` and is consumed on first use, so the
 *    same signed message cannot be submitted twice.
 *  - `Issued At` bounds how long a captured message stays plausible.
 *
 * The exact bytes matter. The API recovers the signer from this string, so any
 * difference — a stray space, a reordered line — invalidates the signature.
 */
export interface SiweMessageParams {
  address: string;
  nonce: string;
  /** Defaults to the current origin's host. */
  domain?: string;
  uri?: string;
  chainId?: number;
  issuedAt?: string;
  statement?: string;
}

export function buildSiweMessage(params: SiweMessageParams): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';

  const {
    address,
    nonce,
    domain = host,
    uri = origin,
    chainId = ARC_CHAIN_ID,
    issuedAt = new Date().toISOString(),
    statement = 'Sign in to Rivora. This does not authorise any transaction.',
  } = params;

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}
