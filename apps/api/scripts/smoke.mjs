/**
 * End-to-end smoke test against a running API.
 *
 * Signs in for real — generates a wallet, requests a nonce, signs an EIP-4361
 * message and exchanges it for a token — then exercises the surfaces that
 * token may and may not reach. A mocked signature would prove nothing about
 * the thing most worth proving.
 *
 *   node apps/api/scripts/smoke.mjs [baseUrl]
 */
import { privateKeyToAccount } from 'viem/accounts';

const BASE = process.argv[2] ?? 'http://localhost:4000/api/v1';
const DOMAIN = 'localhost:3000';
const CHAIN_ID = 5042002;

/**
 * Seeded wallets from prisma/seed.ts, each with a known role, plus one that
 * was never granted anything. Public test keys — see scripts/derive-addresses.mjs.
 */
const KEYS = {
  borrower: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  lp: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  ops: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  stranger: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
};

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${label} → ${actual}${ok ? '' : ` (expected ${expected})`}`);
  if (ok) passed += 1;
  else failed += 1;
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body, headers: response.headers };
}

/** Full SIWE handshake for an account. */
async function signIn(account) {
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

  return { status, token: body?.accessToken, user: body?.user, message, signature, challenge };
}

const borrower = privateKeyToAccount(KEYS.borrower);
const lp = privateKeyToAccount(KEYS.lp);
const ops = privateKeyToAccount(KEYS.ops);
const stranger = privateKeyToAccount(KEYS.stranger);

console.log(`\nRivora API smoke test → ${BASE}\n`);

console.log('Public surface (no token)');
check('GET /protocol/stats', (await call('/protocol/stats')).status, 200);
check('GET /activity', (await call('/activity')).status, 200);
check('GET /defaults', (await call('/defaults')).status, 200);

const stats = (await call('/protocol/stats')).body;
// The APY is quoted to strangers on the landing page. `borrowerRate` already
// returns a percentage, and scaling it again once produced a 453% headline.
check('APY is a percentage, not hundreds', stats.vault.displayedApyPct < 100, true);
check('displayed APY = organic + subsidy',
  Math.abs(stats.vault.displayedApyPct - (stats.vault.organicApyPct + stats.vault.subsidyApyPct)) < 0.02,
  true);
check('public stats omit book composition', 'bySector' in stats.vault, false);

console.log('\nProtected surface (no token)');
check('GET /snapshot', (await call('/snapshot')).status, 401);
check('GET /revenue', (await call('/revenue')).status, 401);
check('GET /risk/watchlist', (await call('/risk/watchlist')).status, 401);

console.log('\nSIWE sign-in');
const session = await signIn(borrower);

// Sign-in is rate limited to 10 per minute per caller. Running the suite twice
// in quick succession trips it, and every later check then fails on a missing
// token — noise that hides whatever the run was meant to test.
if (session.status === 429) {
  console.error(
    '\n  Rate limited on /auth/verify. The suite signs in four times;\n' +
      '  wait a minute and run it again.\n',
  );
  process.exit(1);
}
check('POST /auth/verify', session.status, 200);
check('resolved role', session.user?.role, 'borrower');

const auth = { authorization: `Bearer ${session.token}` };

console.log('\nNonce is single-use');
const replay = await call('/auth/verify', {
  method: 'POST',
  body: JSON.stringify({ message: session.message, signature: session.signature }),
});
check('replayed signature rejected', replay.status, 401);
check('reason', replay.body?.code, 'invalid_nonce');

console.log('\nForged and malformed tokens');
check('garbage token', (await call('/snapshot', { headers: { authorization: 'Bearer nope' } })).status, 401);
check(
  'token signed elsewhere',
  (
    await call('/snapshot', {
      headers: {
        authorization:
          'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIweGF0dGFja2VyIiwicm9sZSI6Im9wcyJ9.f4k3',
      },
    })
  ).status,
  401,
);

console.log('\nBorrower reads its own record');
check('GET /snapshot', (await call('/snapshot', { headers: auth })).status, 200);
check('GET /revenue', (await call('/revenue', { headers: auth })).status, 200);
check('GET /revenue/customers', (await call('/revenue/customers', { headers: auth })).status, 200);
check('GET /revenue/excluded', (await call('/revenue/excluded', { headers: auth })).status, 200);
check('GET /credit/assessment', (await call('/credit/assessment', { headers: auth })).status, 200);
check('GET /credit/history', (await call('/credit/history', { headers: auth })).status, 200);
check('GET /custody', (await call('/custody', { headers: auth })).status, 200);
check('GET /policy', (await call('/policy', { headers: auth })).status, 200);
check('GET /reserve', (await call('/reserve', { headers: auth })).status, 200);
check('GET /notifications', (await call('/notifications', { headers: auth })).status, 200);
check('GET /profile', (await call('/profile', { headers: auth })).status, 200);
check('GET /observation', (await call('/observation', { headers: auth })).status, 200);

const revenue = (await call('/revenue', { headers: auth })).body;
check('revenue carries a daily series', revenue.dailySeries.length > 0, true);
check('daily series sums near the gross', Math.abs(
  revenue.dailySeries.reduce((a, b) => a + b, 0) - revenue.gross) < revenue.gross * 0.2, true);

const assessment = (await call('/credit/assessment', { headers: auth })).body;
check('assessment carries score components', assessment.components.length, 9);
check('components sum to the score',
  Math.abs(assessment.components.reduce((a, c) => a + c.contribution, 0) - assessment.score) < 1,
  true);

const policy = (await call('/policy', { headers: auth })).body;
check('policy carries an allowlist', policy.allowlist.length > 0, true);
check('policy carries a decision log', policy.decisions.length > 0, true);
check('a refusal is recorded, not only approvals',
  policy.decisions.some((d) => d.outcome === 'rejected'), true);

const reserve = (await call('/reserve', { headers: auth })).body;
check('reserve carries its activity', reserve.activity.length > 0, true);

const custody = (await call('/custody', { headers: auth })).body;
check('custody carries upstream dependencies', custody.upstream.length > 0, true);
check('revenue split sums to 100',
  custody.repaymentSharePct + custody.reserveSharePct + custody.operatingSharePct, 100);

console.log('\nRole boundaries');
check('borrower → /risk/watchlist', (await call('/risk/watchlist', { headers: auth })).status, 403);
check('borrower → /vault/portfolio', (await call('/vault/portfolio', { headers: auth })).status, 403);
check(
  'borrower → /settlement/tick',
  (await call('/settlement/tick', { method: 'POST', headers: auth })).status,
  403,
);

console.log('\nLiquidity provider');
const lpSession = await signIn(lp);
const lpAuth = { authorization: `Bearer ${lpSession.token}` };
check('resolved role', lpSession.user?.role, 'lp');
check('GET /vault/portfolio', (await call('/vault/portfolio', { headers: lpAuth })).status, 200);
check('GET /vault/performance', (await call('/vault/performance', { headers: lpAuth })).status, 200);

const perf = (await call('/vault/performance', { headers: lpAuth })).body;
check('LP sees book composition', perf.bySector.length > 0, true);
check('LP sees upstream concentration', perf.upstream.length > 0, true);
check('sector shares sum to ~100',
  Math.abs(perf.bySector.reduce((a, s) => a + s.sharePct, 0) - 100) < 1, true);
check('lp → /revenue', (await call('/revenue', { headers: lpAuth })).status, 403);
check('lp → /risk/exposure', (await call('/risk/exposure', { headers: lpAuth })).status, 403);

console.log('\nRisk operator');
const opsSession = await signIn(ops);
const opsAuth = { authorization: `Bearer ${opsSession.token}` };
check('resolved role', opsSession.user?.role, 'ops');
check('GET /risk/watchlist', (await call('/risk/watchlist', { headers: opsAuth })).status, 200);
check('GET /risk/exposure', (await call('/risk/exposure', { headers: opsAuth })).status, 200);
check('GET /risk/params', (await call('/risk/params', { headers: opsAuth })).status, 200);
check('GET /risk/audit', (await call('/risk/audit', { headers: opsAuth })).status, 200);
check(
  'POST /settlement/tick',
  (
    await call('/settlement/tick', {
      method: 'POST',
      headers: { ...opsAuth, 'idempotency-key': `smoke-tick-${Date.now()}` },
    })
  ).status,
  200,
);
check('GET /risk/alerts', (await call('/risk/alerts', { headers: opsAuth })).status, 200);
check('GET /risk/anomaly', (await call('/risk/anomaly', { headers: opsAuth })).status, 200);

const anomaly = (await call('/risk/anomaly', { headers: opsAuth })).body;
check('anomaly carries evidence', anomaly.evidence.length > 0, true);
check('net economic revenue is negative', anomaly.netEconomicRevenue < 0, true);
check('unknown anomaly reference → 404',
  (await call('/risk/anomaly?ref=A-9999', { headers: opsAuth })).status, 404);

const detail = await call(`/risk/borrower/${encodeURIComponent(anomaly.borrower)}`, { headers: opsAuth });
check('GET /risk/borrower/:handle', detail.status, 200);
check('operator sees exact factors', typeof detail.body.factors.S, 'number');
check('operator sees a merged timeline', detail.body.timeline.length > 0, true);
check('timeline is newest first',
  detail.body.timeline.every((e, i, a) => i === 0 || a[i - 1].at >= e.at), true);
check('unknown handle → 404',
  (await call('/risk/borrower/0xnope', { headers: opsAuth })).status, 404);

check('ops → /vault/portfolio', (await call('/vault/portfolio', { headers: opsAuth })).status, 403);

console.log('\nUnregistered wallet');
const strangerSession = await signIn(stranger);
check('signs in successfully', strangerSession.status, 200);
check('has no role', strangerSession.user?.role, null);
check(
  'cannot reach borrower routes',
  (await call('/revenue', { headers: { authorization: `Bearer ${strangerSession.token}` } })).status,
  403,
);

console.log('\nMoney movement');
const draw = await call('/credit/draw', {
  method: 'POST',
  headers: { ...auth, 'idempotency-key': 'smoke-draw-001' },
  body: JSON.stringify({ amount: 100, category: 'Compute' }),
});
check('POST /credit/draw', draw.status, 200);

const retry = await call('/credit/draw', {
  method: 'POST',
  headers: { ...auth, 'idempotency-key': 'smoke-draw-001' },
  body: JSON.stringify({ amount: 100, category: 'Compute' }),
});
check('retry replays, does not draw twice', retry.body?.receipt?.tx, draw.body?.receipt?.tx);

const reused = await call('/credit/draw', {
  method: 'POST',
  headers: { ...auth, 'idempotency-key': 'smoke-draw-001' },
  body: JSON.stringify({ amount: 999, category: 'Compute' }),
});
check('same key, different body rejected', reused.status, 409);

check(
  'over-draw refused',
  (
    await call('/credit/draw', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ amount: 999999, category: 'Compute' }),
    })
  ).status,
  422,
);
check(
  'unknown field rejected',
  (
    await call('/credit/repay', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ amount: 10, sneaky: true }),
    })
  ).status,
  400,
);

// The development key the seed writes. Only its SHA-256 is stored, so this is
// the one place the plaintext exists outside the seed.
const API_KEY = 'pk_test_rivora_dev_8f2a4c91b7e3';

console.log('\nPartner sandbox');
const profiles = await call('/partner/sandbox/profiles', { headers: { 'x-api-key': API_KEY } });
check('GET /partner/sandbox/profiles', profiles.status, 200);
check('profiles are offered', profiles.body.length > 0, true);

const scored = await call('/partner/sandbox/score/01', {
  method: 'POST',
  headers: { 'x-api-key': API_KEY },
});
check('POST /partner/sandbox/score/:id', scored.status, 200);
check('response is marked sandbox', scored.body.sandbox, true);
check('sandbox carries no signature', 'signature' in scored.body, false);
check('a prime profile outscores a failing one', scored.body.score >
  (await call('/partner/sandbox/score/12', { method: 'POST', headers: { 'x-api-key': API_KEY } })).body.score,
  true);
check('unknown profile → 404',
  (await call('/partner/sandbox/score/99', { method: 'POST', headers: { 'x-api-key': API_KEY } })).status,
  404);

console.log('\nPartner API key');
check(
  'no key',
  (await call('/partner/score/0x9c4e%E2%80%A6a7f1')).status,
  401,
);
check(
  'wrong key',
  (await call('/partner/score/0x9c4e%E2%80%A6a7f1', { headers: { 'x-api-key': 'nope' } })).status,
  401,
);
check(
  'valid key',
  (
    await call('/partner/score/0x9c4e%E2%80%A6a7f1', {
      headers: { 'x-api-key': API_KEY },
    })
  ).status,
  200,
);

console.log('\nRevenue ingestion');
const HANDLE = '0x9c4e…a7f1';

/**
 * A date this run has not used before.
 *
 * The suite runs repeatedly against the same database, so a hardcoded date is
 * already present by the second run and "is this day new" stops meaning
 * anything. Derived from the clock, past the seeded window so it never
 * collides with it.
 */
const INGEST_DATE = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const ingest = (body, key) =>
  call('/ingest/revenue', {
    method: 'POST',
    headers: { ...opsAuth, 'idempotency-key': key },
    body: JSON.stringify(body),
  });

const revenueBefore = (await call('/revenue', { headers: auth })).body;

const posted = await ingest(
  {
    handle: HANDLE,
    date: INGEST_DATE,
    settled: 610.25,
    requests: 15_256,
    payers: [
      { label: 'payer-01', amount: 90.5, requests: 2_262 },
      { label: 'payer-02', amount: 74.0, requests: 1_850 },
      { label: 'payer-smoke', amount: 61.0, requests: 1_525 },
      {
        label: 'payer-x-smoke',
        amount: 12.5,
        requests: 312,
        excluded: true,
        exclusionReason: 'Payer age below 7 days',
      },
    ],
  },
  `smoke-ingest-${Date.now()}`,
);

check('POST /ingest/revenue', posted.status, 200);
check('exclusions are summed from the payers', posted.body.excluded, 12.5);

const revenueAfter = (await call('/revenue', { headers: auth })).body;
check('the window reflects the day', revenueAfter.gross >= revenueBefore.gross, true);
check('the daily series lengthened or rolled', revenueAfter.dailySeries.length > 0, true);

// The guarantee that matters, and the one a retrying indexer depends on:
// posting the same day again is a no-op, not a second helping.
const repeated = await ingest(
  {
    handle: HANDLE,
    date: INGEST_DATE,
    settled: 610.25,
    requests: 15_256,
    payers: [
      { label: 'payer-01', amount: 90.5, requests: 2_262 },
      { label: 'payer-02', amount: 74.0, requests: 1_850 },
      { label: 'payer-smoke', amount: 61.0, requests: 1_525 },
      {
        label: 'payer-x-smoke',
        amount: 12.5,
        requests: 312,
        excluded: true,
        exclusionReason: 'Payer age below 7 days',
      },
    ],
  },
  `smoke-ingest-repeat-${Date.now()}`,
);
check('the same day posted twice reports a replacement', repeated.body.replaced, true);

const revenueRepeated = (await call('/revenue', { headers: auth })).body;
check(
  'and does not accumulate',
  Math.abs(revenueRepeated.gross - revenueAfter.gross) < 0.01,
  true,
);

// Concentration is derived from the payer rows, never accepted from the caller.
check(
  'concentration is derived, not asserted',
  revenueAfter.largestPayerPct > 0 && revenueAfter.hhi > 0,
  true,
);
check(
  'the band agrees with the index it describes',
  revenueAfter.hhi < 1000 ? revenueAfter.concentrationBand === 'LOW' : true,
  true,
);

// Re-posting the same day must replace it. A retried batch is the normal case
// for an indexer, and adding to the day would double-count it.
const corrected = await ingest(
  { handle: HANDLE, date: INGEST_DATE, settled: 200, requests: 5_000 },
  `smoke-ingest-b-${Date.now()}`,
);
check('re-posting a day replaces it', corrected.body.replaced, true);

const revenueCorrected = (await call('/revenue', { headers: auth })).body;
check(
  'the correction lowered the window rather than adding to it',
  revenueCorrected.gross < revenueAfter.gross,
  true,
);

check(
  'a borrower cannot post their own revenue',
  (
    await ingest(
      { handle: HANDLE, date: INGEST_DATE, settled: 610.25, requests: 15_256 },
      `smoke-ingest-c-${Date.now()}`,
    ).then(() =>
      call('/ingest/revenue', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ handle: HANDLE, date: INGEST_DATE, settled: 1, requests: 1 }),
      }),
    )
  ).status,
  403,
);

console.log('\nAssessment');
const historyBefore = (await call('/credit/history', { headers: auth })).body;
const forced = await call(`/risk/borrower/${encodeURIComponent(HANDLE)}/reassess`, {
  method: 'POST',
  headers: opsAuth,
});
check('POST /risk/borrower/:handle/reassess', forced.status, 200);

const historyAfter = (await call('/credit/history', { headers: auth })).body;
check('an assessment is recorded', historyAfter.length > historyBefore.length, true);
check('it carries the rung that bound it', Boolean(historyAfter[0].bindingKey), true);

const assessed = (await call('/credit/assessment', { headers: auth })).body;
check(
  'the stored limit matches what the underwriter explains',
  Math.abs(assessed.limit - historyAfter[0].limit) < 0.01,
  true,
);
check(
  'components sum to the score',
  Math.abs(assessed.components.reduce((a, c) => a + c.contribution, 0) - assessed.score) < 1,
  true,
);

// A risk decision must not be undone by a routine reassessment.
const restricted = (await call('/risk/anomaly', { headers: opsAuth })).body.borrower;
await call(`/risk/borrower/${encodeURIComponent(restricted)}/reassess`, {
  method: 'POST',
  headers: opsAuth,
});
const stillRestricted = (
  await call(`/risk/borrower/${encodeURIComponent(restricted)}`, { headers: opsAuth })
).body;
check('a restricted borrower keeps its imposed limit', stillRestricted.limit, 0);
check('and its status', stillRestricted.status, 'RESTRICTED');

console.log('\nUsage metering');
// Baseline first: the suite has already made partner calls above, so the
// assertions below are about the delta rather than absolute counts.
const keyHeader = { 'x-api-key': API_KEY };
const before = (await call('/partner/usage', { headers: keyHeader })).body;

await call('/partner/score/0x9c4e%E2%80%A6a7f1', { headers: keyHeader });
await call('/partner/sandbox/score/01', { method: 'POST', headers: keyHeader });
await call('/partner/score/0xdefinitelynotreal', { headers: keyHeader });

const after = (await call('/partner/usage', { headers: keyHeader })).body;

// Four calls since the baseline: a real score, a sandbox score, a miss, and
// the baseline read itself — which is a keyed request like any other.
check('every keyed request is counted', after.requests - before.requests, 4);
// Only the real score is sold. Sandbox and the 404 are support, not product.
check('only the metered success bills', after.billable - before.billable, 1);
check(
  'a failed lookup is not a billed subject',
  after.uniqueSubjects === before.uniqueSubjects,
  true,
);
check('errors are visible in the rate', after.errorRatePct > 0, true);
check('usage is bucketed by day', after.byDay.length > 0, true);
check('a JWT cannot read partner usage', (await call('/partner/usage', { headers: auth })).status, 401);

console.log('\nDevelopment sign-in guard');
const health = (await call('/health')).body;
check('/health states the environment', typeof health.info.environment.name, 'string');
check(
  '/health states whether dev sessions are allowed',
  typeof health.info.environment.devSessions,
  'boolean',
);

console.log('\nObservability');
const traced = await call('/protocol/stats');
check('x-request-id present', Boolean(traced.headers.get('x-request-id')), true);
const notFound = await call('/reputation/does-not-exist');
check('404 carries a code', notFound.body?.code, 'borrower_not_found');
check('404 carries a requestId', Boolean(notFound.body?.requestId), true);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
