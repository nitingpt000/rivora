/**
 * Mints a browser session for one of the seeded development wallets.
 *
 * Signs a real SIWE message with a known Anvil key and prints the
 * `sessionStorage` entry the web app restores from — so an authenticated
 * surface can be opened without a browser wallet installed.
 *
 * Development only. The keys are public test keys and the API only accepts
 * them because the seed granted those addresses a role.
 *
 *   node apps/api/scripts/dev-session.mjs borrower
 */
import { privateKeyToAccount } from 'viem/accounts';

const KEYS = {
  borrower: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  lp: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  ops: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
};

const API = process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1';
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 5042002);

const role = process.argv[2] ?? 'borrower';
const key = KEYS[role];

if (!key) {
  console.error(`Unknown role "${role}". Expected one of: ${Object.keys(KEYS).join(', ')}`);
  process.exit(1);
}

const account = privateKeyToAccount(key);
const domain = new URL(ORIGIN).host;

const nonceResponse = await fetch(`${API}/auth/nonce`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ address: account.address }),
});

if (!nonceResponse.ok) {
  console.error(`Nonce request failed: ${nonceResponse.status}`);
  process.exit(1);
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
  console.error(`Verify failed: ${verified.status}`, await verified.text());
  process.exit(1);
}

const tokens = await verified.json();

console.log(
  JSON.stringify({
    token: tokens.accessToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    user: tokens.user,
  }),
);
