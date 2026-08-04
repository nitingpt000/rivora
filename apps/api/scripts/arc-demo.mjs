/**
 * Drives the API's money paths in arc mode, as a user would.
 *
 * Everything goes through the HTTP surface with a real SIWE session — the
 * point is to watch a screen-level action come back carrying an Arc
 * transaction hash, not to poke contracts directly (arc-ops.mjs does that).
 *
 *   node apps/api/scripts/arc-demo.mjs assess     # ops → reassess → registry export
 *   node apps/api/scripts/arc-demo.mjs draw 3     # borrower → Manager.draw
 *
 * Sequence matters: `assess` puts a signed limit in the registry, arc-ops
 * `sync` adopts it in the Manager (OBSERVATION → ACTIVE), and only then can
 * `draw` fund. Uses the same public seeded test keys as smoke.mjs, and the
 * same dev-session rules apply — this only works against a local stack.
 */
import { privateKeyToAccount } from 'viem/accounts';

const BASE = process.argv[2]?.startsWith('http')
  ? process.argv[2]
  : 'http://localhost:4000/api/v1';
const DOMAIN = 'localhost:3000';
const CHAIN_ID = 5042002;
const BORROWER_HANDLE = '0x9c4e…a7f1';
const EXPLORER = 'https://testnet.arcscan.app/tx';

const KEYS = {
  borrower: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  ops: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
};

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function signIn(key) {
  const account = privateKeyToAccount(key);
  const { body: challenge } = await call('/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ address: account.address }),
  });

  const message = [
    `${DOMAIN} wants you to sign in with your Ethereum account:`,
    account.address,
    '',
    'Sign in to Rivora.',
    '',
    `URI: http://${DOMAIN}`,
    'Version: 1',
    `Chain ID: ${CHAIN_ID}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');

  const signature = await account.signMessage({ message });
  const { status, body } = await call('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  });
  if (status !== 200) throw new Error(`sign-in failed: ${status} ${JSON.stringify(body)}`);
  return { authorization: `Bearer ${body.accessToken}` };
}

const command = process.argv[2];

if (command === 'assess') {
  const auth = await signIn(KEYS.ops);
  console.log('signed in as risk operator; requesting reassessment…');

  const path = `/risk/borrower/${encodeURIComponent(BORROWER_HANDLE)}/reassess`;
  const { status, body } = await call(path, { method: 'POST', headers: auth });
  if (status !== 200 && status !== 201) {
    console.error(`reassess failed: ${status} ${JSON.stringify(body)}`);
    process.exitCode = 1;
  } else {
    console.log(`reassessed: score ${body.score}, limit ${body.limit ?? body.limitAmount ?? '?'}`);

    const { body: activity } = await call('/activity');
    const events = Array.isArray(activity) ? activity : (activity?.events ?? []);
    const exported = events.find((event) => event.type === 'assessment.exported');
    if (exported) {
      console.log(`\nassessment exported to the registry:`);
      console.log(`  ${EXPLORER}/${exported.tx}`);
    } else {
      console.error(
        '\nNO assessment.exported event found — the export failed. Check the API logs.',
      );
      process.exitCode = 1;
    }
  }
} else if (command === 'draw') {
  const amount = Number(process.argv[3]);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Usage: arc-demo.mjs draw <usdc amount>');
    process.exitCode = 1;
  } else {
    const auth = await signIn(KEYS.borrower);
    console.log(`signed in as borrower; drawing ${amount} USDC…`);

    const { status, body } = await call('/credit/draw', {
      method: 'POST',
      headers: { ...auth, 'idempotency-key': `arc-demo-${Date.now()}` },
      body: JSON.stringify({ amount, category: 'Compute' }),
    });

    if (status !== 200) {
      console.error(`draw failed: ${status} ${JSON.stringify(body)}`);
      process.exitCode = 1;
    } else {
      const tx = body.receipt?.tx;
      console.log(`\ndraw completed onchain:`);
      console.log(`  ${EXPLORER}/${tx}`);
    }
  }
} else {
  console.error('Usage: arc-demo.mjs assess | draw <amount>');
  process.exitCode = 1;
}
