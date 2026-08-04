/**
 * A paying agent. PRD §37.
 *
 * Calls the paid endpoint, gets a 402, signs the EIP-3009 authorization the
 * challenge asks for, and retries — which is the whole x402 handshake, done
 * by software with no account and no API key. The payment *is* the
 * credential.
 *
 *   node apps/api/scripts/x402-agent.mjs [requests] [baseUrl]
 *
 * Signs with a public Anvil key: this buys testnet data from a testnet
 * seller, and the authorization is never settled onchain by this repo.
 */
import { randomBytes } from 'node:crypto';

import { privateKeyToAccount } from 'viem/accounts';

const COUNT = Number(process.argv[2] ?? 3);
const BASE = process.argv[3] ?? 'http://localhost:4000/api/v1';
const RESOURCE = `${BASE}/x402/quote`;

/** Anvil #9 — a buyer, distinct from every seeded protocol participant. */
const BUYER = privateKeyToAccount(
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
);

const SYMBOLS = ['ETH-USD', 'BTC-USD', 'SOL-USD', 'ARB-USD', 'OP-USD'];

async function payFor(symbol) {
  const url = `${RESOURCE}?symbol=${symbol}`;

  // 1 — ask, unpaid.
  const unpaid = await fetch(url);
  if (unpaid.status !== 402) {
    console.log(`  ${symbol}: expected 402, got ${unpaid.status}`);
    return false;
  }

  const challenge = await unpaid.json();
  const terms = challenge.accepts?.[0];
  if (!terms) {
    console.log(`  ${symbol}: the challenge named no terms`);
    return false;
  }

  // 2 — sign exactly what was asked for.
  const now = Math.floor(Date.now() / 1000);
  const message = {
    from: BUYER.address,
    to: terms.payTo,
    value: BigInt(terms.maxAmountRequired),
    validAfter: BigInt(now - 60),
    validBefore: BigInt(now + (terms.maxTimeoutSeconds ?? 300)),
    // Single-use. Random rather than sequential: two agents paying the same
    // seller must not collide, and neither holds a counter.
    nonce: `0x${randomBytes(32).toString('hex')}`,
  };

  const signature = await BUYER.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: Number(String(terms.network).split(':')[1]),
      verifyingContract: terms.asset,
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

  const authorization = Buffer.from(
    JSON.stringify({
      from: message.from,
      to: message.to,
      value: message.value.toString(),
      validAfter: message.validAfter.toString(),
      validBefore: message.validBefore.toString(),
      nonce: message.nonce,
      signature,
    }),
  ).toString('base64');

  // 3 — retry, paid.
  const paid = await fetch(url, { headers: { 'x-payment': authorization } });
  const body = await paid.json();

  if (paid.status !== 200) {
    console.log(`  ${symbol}: refused — ${body.error} (${body.reason ?? ''})`);
    return false;
  }

  console.log(
    `  ${symbol.padEnd(8)} ${String(body.price).padStart(9)} · paid ${body.amountPaid} USDC`,
  );
  return { authorization, url };
}

console.log(`\nPaying agent ${BUYER.address}`);
console.log(`Seller       ${RESOURCE}\n`);

let paid = 0;
let replayed;
for (let i = 0; i < COUNT; i += 1) {
  const result = await payFor(SYMBOLS[i % SYMBOLS.length]);
  if (result) {
    paid += 1;
    replayed ??= result;
  }
}

// The check worth making: a spent authorization must not buy a second
// resource. Replay protection is the difference between charging per request
// and charging once.
if (replayed) {
  const again = await fetch(replayed.url, { headers: { 'x-payment': replayed.authorization } });
  const body = await again.json();
  console.log(`\nreplaying a spent authorization → ${again.status} ${body.error ?? ''}`);
}

const takings = await (await fetch(`${BASE}/x402/takings`)).json();
console.log(
  `\ntakings: ${takings.paidRequests} paid requests · ${takings.revenue} USDC · ${takings.uniquePayers} payer(s)`,
);
console.log(`payTo:   ${takings.payTo} ${takings.routed ? '(revenue router)' : '(operating wallet)'}`);
console.log(`\n${paid}/${COUNT} purchases completed.\n`);
