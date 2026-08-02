/**
 * `viem` is ESM-only and this app compiles to CommonJS, so it is loaded with a
 * dynamic import rather than a top-level one. Cached, because resolving the
 * module on every sign-in would put filesystem work on the auth path.
 *
 * Typed structurally rather than with `typeof import('viem')`, which a
 * CommonJS program cannot reference without a resolution-mode attribute. Only
 * signature recovery is needed — a pure function over the message and the
 * signature, with no network access.
 */
type RecoverMessageAddress = (args: {
  message: string;
  signature: `0x${string}`;
}) => Promise<string>;

let recoverPromise: Promise<RecoverMessageAddress> | null = null;

function recoverer(): Promise<RecoverMessageAddress> {
  recoverPromise ??= import('viem').then(
    (module) => module.recoverMessageAddress as unknown as RecoverMessageAddress,
  );
  return recoverPromise;
}

/**
 * EIP-4361 (Sign-In With Ethereum) message handling.
 *
 * Parsed and checked here rather than with a library, because the checks are
 * the security property and they should be readable. The signature only proves
 * that *some* message was signed by a key — everything that makes it a login
 * for this site, this nonce, and this moment is asserted below.
 */

export interface SiweFields {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
}

export class SiweParseError extends Error {}

const HEADER = /^(?<domain>[^\s]+) wants you to sign in with your Ethereum account:\n(?<address>0x[0-9a-fA-F]{40})\n/;

function field(body: string, name: string): string | undefined {
  const match = new RegExp(`^${name}: (.+)$`, 'm').exec(body);
  return match?.[1]?.trim();
}

export function parseSiweMessage(message: string): SiweFields {
  const header = HEADER.exec(message);
  if (!header?.groups) {
    throw new SiweParseError('Message is not a valid EIP-4361 sign-in request.');
  }

  const required = {
    uri: field(message, 'URI'),
    version: field(message, 'Version'),
    chainId: field(message, 'Chain ID'),
    nonce: field(message, 'Nonce'),
    issuedAt: field(message, 'Issued At'),
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value) throw new SiweParseError(`Message is missing the ${name} field.`);
  }

  const chainId = Number(required.chainId);
  if (!Number.isInteger(chainId)) {
    throw new SiweParseError('Chain ID must be an integer.');
  }

  // Everything between the address block and the first labelled field.
  const statement = /\n\n([\s\S]*?)\n\nURI: /.exec(message)?.[1];

  return {
    domain: header.groups.domain as string,
    address: header.groups.address as string,
    ...(statement ? { statement } : {}),
    uri: required.uri as string,
    version: required.version as string,
    chainId,
    nonce: required.nonce as string,
    issuedAt: required.issuedAt as string,
    ...(field(message, 'Expiration Time') ? { expirationTime: field(message, 'Expiration Time') } : {}),
    ...(field(message, 'Not Before') ? { notBefore: field(message, 'Not Before') } : {}),
  };
}

export interface SiweVerification {
  ok: boolean;
  reason?: string;
  address?: string;
}

/**
 * Verifies a signed sign-in message.
 *
 * Recovers the signer and then checks, in order: that the recovered key is the
 * address the message claims, that the message was issued for a domain we
 * serve, that it is for the chain we run on, and that it is currently valid.
 *
 * The nonce is *not* checked here — consuming it is a database write and
 * belongs in the service, so that a replay is impossible rather than merely
 * detected.
 */
export async function verifySiweMessage(
  message: string,
  signature: `0x${string}`,
  expected: { domains: string[]; chainId: number; now?: Date },
): Promise<SiweVerification> {
  let fields: SiweFields;
  try {
    fields = parseSiweMessage(message);
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : 'Malformed message.' };
  }

  let recovered: string;
  try {
    const recoverMessageAddress = await recoverer();
    recovered = await recoverMessageAddress({ message, signature });
  } catch {
    return { ok: false, reason: 'Signature could not be recovered.' };
  }

  if (recovered.toLowerCase() !== fields.address.toLowerCase()) {
    return { ok: false, reason: 'Signature does not match the address in the message.' };
  }

  // Without this, a signature harvested by any other site could be replayed
  // here — the whole point of binding the domain into the message.
  if (!expected.domains.includes(fields.domain)) {
    return { ok: false, reason: `Message domain "${fields.domain}" is not accepted by this API.` };
  }

  if (fields.chainId !== expected.chainId) {
    return { ok: false, reason: `Message is for chain ${fields.chainId}, expected ${expected.chainId}.` };
  }

  if (fields.version !== '1') {
    return { ok: false, reason: `Unsupported SIWE version "${fields.version}".` };
  }

  const now = expected.now ?? new Date();

  const issuedAt = Date.parse(fields.issuedAt);
  if (Number.isNaN(issuedAt)) {
    return { ok: false, reason: 'Issued At is not a valid timestamp.' };
  }
  // A small tolerance for clock skew between the signer and this server.
  if (issuedAt - now.getTime() > 60_000) {
    return { ok: false, reason: 'Message is issued in the future.' };
  }

  if (fields.expirationTime && Date.parse(fields.expirationTime) <= now.getTime()) {
    return { ok: false, reason: 'Message has expired.' };
  }

  if (fields.notBefore && Date.parse(fields.notBefore) > now.getTime()) {
    return { ok: false, reason: 'Message is not yet valid.' };
  }

  return { ok: true, address: recovered.toLowerCase() };
}
