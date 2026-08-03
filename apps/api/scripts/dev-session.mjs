/**
 * Mints a browser session for one of the seeded development wallets.
 *
 * Signs a real SIWE message with a known Anvil key and prints the
 * `sessionStorage` entry the web app restores from — so an authenticated
 * surface can be opened without a browser wallet installed.
 *
 *   node apps/api/scripts/dev-session.mjs borrower
 *
 * The keys below are the standard public Anvil accounts. Anyone can sign with
 * them; what makes a session possible is that the *seed* granted those
 * addresses a role. So the danger is not this file — it is seeding those
 * grants somewhere that matters.
 *
 * As a second line of defence the script asks the target API whether it
 * tolerates development sessions at all, and refuses if it does not. The
 * deployment decides; the script does not get to assume.
 */
import { privateKeyToAccount } from 'viem/accounts';

const KEYS = {
  borrower: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  lp: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  ops: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  ops2: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  partner: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
};

const API = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 5042002);

/** Refusal carrying its own explanation. */
class Refused extends Error {}

/**
 * Refuses to run against a deployment that has not opted in.
 *
 * Read from the API rather than from a local variable: an env var the caller
 * sets is a statement about the caller, and the question here is what the
 * *target* is. Anything unexpected — an unreachable host, a malformed body, a
 * missing field — refuses. A guard that fails open is not a guard.
 */
async function assertDevelopmentTarget() {
  let body;

  try {
    body = await (await fetch(`${API}/health`)).json();
  } catch (cause) {
    throw new Refused(
      [
        `Could not reach ${API}/health — ${String(cause)}`,
        'Refusing to sign: the target could not confirm it is a development stack.',
      ].join('\n'),
    );
  }

  const environment = body?.info?.environment ?? body?.details?.environment;
  if (environment?.devSessions === true) return;

  throw new Refused(
    [
      `Refusing to mint a session against ${API}.`,
      '',
      `That deployment reports environment "${environment?.name ?? 'unknown'}" and does not`,
      'advertise support for development sessions.',
      '',
      'This script signs with a public Anvil key. Against anything but a local stack',
      'seeded with those keys, that is handing out a session to an address you do',
      'not control.',
    ].join('\n'),
  );
}

async function main() {
  const role = process.argv[2] ?? 'borrower';
  const key = KEYS[role];

  if (!key) {
    throw new Refused(`Unknown role "${role}". Expected one of: ${Object.keys(KEYS).join(', ')}`);
  }

  await assertDevelopmentTarget();

  const account = privateKeyToAccount(key);
  const domain = new URL(ORIGIN).host;

  const nonceResponse = await fetch(`${API}/auth/nonce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: account.address }),
  });

  if (!nonceResponse.ok) {
    throw new Refused(`Nonce request failed: ${nonceResponse.status}`);
  }

  const { nonce } = await nonceResponse.json();

  // Must match `buildSiweMessage` in @rivora/wallet exactly — the API verifies
  // the signature against the message text, so a stray character fails it.
  const message = [
    `${domain} wants you to sign in with your Ethereum account:`,
    account.address,
    '',
    'Sign in to Rivora. This does not authorise any transaction.',
    '',
    `URI: ${ORIGIN}`,
    'Version: 1',
    `Chain ID: ${CHAIN_ID}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');

  const signature = await account.signMessage({ message });

  const verified = await fetch(`${API}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });

  if (!verified.ok) {
    throw new Refused(`Verify failed: ${verified.status} ${await verified.text()}`);
  }

  const tokens = await verified.json();

  console.log(
    JSON.stringify({
      token: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      user: tokens.user,
    }),
  );
}

try {
  await main();
} catch (cause) {
  console.error(cause instanceof Refused ? cause.message : String(cause));
  // `exitCode` rather than `process.exit()`: the latter tears down the event
  // loop while fetch still holds a socket, which trips a libuv assertion on
  // Windows and reports 127 instead of the failure we meant.
  process.exitCode = 1;
}
