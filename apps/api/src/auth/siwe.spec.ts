import { beforeAll, describe, expect, it } from 'vitest';

import { parseSiweMessage, verifySiweMessage } from './siwe';

/**
 * `viem` is ESM-only and this app compiles to CommonJS, so it is imported
 * dynamically here for the same reason the implementation does it.
 */
interface TestAccount {
  address: string;
  signMessage: (args: { message: string }) => Promise<`0x${string}`>;
}

/**
 * Signed with a real key and verified through real recovery.
 *
 * Mocking the signature would test nothing worth testing: the point of these
 * cases is that a message signed by one key cannot authenticate another, and
 * that every binding in the message is actually enforced.
 */
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;
const OTHER_KEY = '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' as const;

const NOW = new Date('2026-08-02T14:31:07.000Z');
const EXPECTED = { domains: ['localhost:3000'], chainId: 5042002, now: NOW };

let account: TestAccount;
let other: TestAccount;

beforeAll(async () => {
  const { privateKeyToAccount } = await import('viem/accounts');
  account = privateKeyToAccount(PRIVATE_KEY) as unknown as TestAccount;
  other = privateKeyToAccount(OTHER_KEY) as unknown as TestAccount;
});

interface MessageFields {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

function message(overrides: Partial<MessageFields> = {}, address?: string): string {
  const fields: MessageFields = {
    domain: 'localhost:3000',
    address: address ?? account.address,
    statement: 'Sign in to Rivora.',
    uri: 'http://localhost:3000',
    version: '1',
    chainId: '5042002',
    nonce: 'k7Qm2Xp9Rt4Nw8Lz',
    issuedAt: '2026-08-02T14:30:00.000Z',
    ...overrides,
  };

  return [
    `${fields.domain} wants you to sign in with your Ethereum account:`,
    fields.address,
    '',
    fields.statement,
    '',
    `URI: ${fields.uri}`,
    `Version: ${fields.version}`,
    `Chain ID: ${fields.chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    ...(fields.expirationTime ? [`Expiration Time: ${fields.expirationTime}`] : []),
  ].join('\n');
}

describe('parseSiweMessage', () => {
  it('reads every field out of a well-formed message', () => {
    const parsed = parseSiweMessage(message());

    expect(parsed.domain).toBe('localhost:3000');
    expect(parsed.address.toLowerCase()).toBe(account.address.toLowerCase());
    expect(parsed.chainId).toBe(5042002);
    expect(parsed.nonce).toBe('k7Qm2Xp9Rt4Nw8Lz');
    expect(parsed.statement).toBe('Sign in to Rivora.');
  });

  it('rejects something that is not a sign-in request', () => {
    expect(() => parseSiweMessage('please send me your keys')).toThrow(/not a valid EIP-4361/);
  });

  it('rejects a message missing a required field', () => {
    const withoutNonce = message().replace(/^Nonce: .+$/m, '');
    expect(() => parseSiweMessage(withoutNonce)).toThrow(/missing the nonce field/);
  });
});

describe('verifySiweMessage', () => {
  it('accepts a correctly signed message', async () => {
    const text = message();
    const signature = await account.signMessage({ message: text });

    const result = await verifySiweMessage(text, signature, EXPECTED);

    expect(result.ok).toBe(true);
    expect(result.address).toBe(account.address.toLowerCase());
  });

  it('rejects a signature from a different key', async () => {
    // The attack this exists to stop: claiming to be one address while
    // holding the key to another.
    const text = message();
    const signature = await other.signMessage({ message: text });

    const result = await verifySiweMessage(text, signature, EXPECTED);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/does not match the address/);
  });

  it('rejects a message whose body was altered after signing', async () => {
    const text = message();
    const signature = await account.signMessage({ message: text });
    const tampered = text.replace('k7Qm2Xp9Rt4Nw8Lz', 'attackerChosenNonce');

    const result = await verifySiweMessage(tampered, signature, EXPECTED);

    expect(result.ok).toBe(false);
  });

  it('rejects a message signed for another site', async () => {
    // Without the domain check, a signature harvested by any other site could
    // be replayed here.
    const text = message({ domain: 'evil.example' });
    const signature = await account.signMessage({ message: text });

    const result = await verifySiweMessage(text, signature, EXPECTED);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/is not accepted by this API/);
  });

  it('rejects a message for a different chain', async () => {
    const text = message({ chainId: '1' });
    const signature = await account.signMessage({ message: text });

    const result = await verifySiweMessage(text, signature, EXPECTED);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expected 5042002/);
  });

  it('rejects an expired message', async () => {
    const text = message({ expirationTime: '2026-08-02T14:00:00.000Z' });
    const signature = await account.signMessage({ message: text });

    const result = await verifySiweMessage(text, signature, EXPECTED);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expired/);
  });

  it('rejects a message issued in the future beyond clock tolerance', async () => {
    const text = message({ issuedAt: '2026-08-02T15:31:07.000Z' });
    const signature = await account.signMessage({ message: text });

    const result = await verifySiweMessage(text, signature, EXPECTED);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/issued in the future/);
  });

  it('rejects an unsupported SIWE version', async () => {
    const text = message({ version: '2' });
    const signature = await account.signMessage({ message: text });

    const result = await verifySiweMessage(text, signature, EXPECTED);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Unsupported SIWE version/);
  });

  it('rejects a malformed signature without throwing', async () => {
    const result = await verifySiweMessage(message(), '0xdeadbeef' as `0x${string}`, EXPECTED);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/could not be recovered/);
  });
});
