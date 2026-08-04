# Backlog

Known gaps, recorded rather than papered over. Each entry says what is wrong
today, why it was left, and what closing it requires.

Ordered by how much a reader is misled by the current state, not by effort.
Closed items stay, struck through, with what was actually done — a backlog that
deletes its history cannot tell you why something is the way it is.

---

## ~~1. Partner console states API usage counters it never measured~~ — closed

`ApiKeyUsage` records a row per keyed request; the console reads real figures.

**What "billable" means, now that it means something.** A route opts in with
`@Metered()` — off by default, so a new endpoint bills nobody until someone
says it should. A metered call is billed only if it succeeded: sandbox calls
and errors appear in `requests` but are never charged, and a handle whose
lookup 404'd is not counted as a subject. The flag is stored per row at call
time rather than derived later, so changing what is metered never retroactively
rewrites an invoice.

`GET /partner/console` (wallet session) reports the caller's own keys;
`GET /partner/usage` (API key) reports the presenting key. Neither takes a
parameter naming a caller, so neither can be pointed at someone else.

**Closing this surfaced a live authorization gap.** See item 2.

---

## ~~2. A session was accepted in place of an API key~~ — fixed

**Where:** [apps/api/src/auth/jwt-auth.guard.ts](apps/api/src/auth/jwt-auth.guard.ts)

Found while wiring usage metering, not by looking for it.

A route declaring `@ApiKeyScopes()` checked for `x-api-key` and, when none was
present, **fell through to the JWT branch**. Any signed-in wallet — a borrower,
a liquidity provider — could call `GET /partner/score/:handle` with no key at
all and get a 200. Verified against the running stack before the fix.

That meant the metered product served for free, past the partner-specific
60/minute throttle, and with nothing recorded: no `request.apiKey`, so no usage
row, so it would not have appeared on any bill either.

A route that declares scopes is now key-authenticated, full stop: no key is a
401. Surfaces a person signs into with a wallet use `@Roles` on their own
controller instead — which is why the new partner console is a separate
controller rather than another route on the keyed one. Three regression tests
in `guards.spec.ts` cover it.

---

## ~~3. `dev-session.mjs` mints sessions from public test keys~~ — guarded

**Where:** [apps/api/scripts/dev-session.mjs](apps/api/scripts/dev-session.mjs)

Signs a real SIWE message with a known Anvil private key and prints the
`sessionStorage` entry the web app restores from, so an authenticated surface
can be opened without a browser wallet installed.

This is genuinely useful — it is how the borrower, LP and operator surfaces
were verified end to end — and it is genuinely a loaded gun. It is a script
whose entire purpose is to produce a valid session for an address it does not
own.

**Why it is safe today.** The keys are the standard public Anvil accounts;
anyone can sign with them. The API accepts the resulting sessions only because
the seed granted those addresses a role in a local database. Against any real
deployment the signature verifies and the role lookup returns nothing.

**What would make it unsafe.** Seeding those addresses into a shared or
deployed environment. The script would then hand a working operator session to
anyone who ran it.

**What was done.** The script asks the target API whether it tolerates
development sessions and refuses if it does not. `/health` reports
`environment.devSessions`, backed by a `DEV_SESSIONS` config flag that is
opt-in, refused outright when `NODE_ENV=production`, and set only by
`docker-compose.yml` — which describes a local stack seeded with those keys.

`NODE_ENV` alone could not answer this: a container image is built in
production mode whether it serves a laptop or the internet, and the local
stack reports `production` for exactly that reason.

The guard fails closed on every path — unreachable host, malformed body,
missing field, unknown role — verified against a deployment without the flag.

**Still open.** The real exposure is the *seed*, not the script: those grants
must never be written anywhere that matters. Nothing enforces that today
beyond the seed being run by hand.

---

## ~~4. Revenue only ever arrived by seeding~~ — closed

Nothing wrote `RevenueDay` or `PayerSummary` outside the seed, so the score,
the limit and the repayment budget were all correct arithmetic over a fixture.

`POST /ingest/revenue` is the write side of the indexer (PRD §25.1),
operator-authenticated because a borrower who could post their own revenue
could post any number they liked. Re-posting a day replaces it rather than
adding to it — a retried batch is the normal case for an indexer, and the
suite asserts that posting the same day twice does not accumulate.

Every window aggregate is **derived** from the posted days: eligible, growth,
largest-payer share, HHI, unique and repeat payers. None is accepted from the
caller.

**Two bugs this exposed.**

`PayerSummary` is a 30-day rollup, and my first version accumulated into it
forever — concentration would have drifted upward as days aged out of the
window but never out of the sum. Fixed by adding a `RevenueDayPayer` grain and
recomputing the rollup from the days inside the window, so a payer who goes
quiet leaves it.

The seed asserted a largest-payer share of 14% beside payer rows holding 43%.
Deriving the figure exposed the contradiction: a single row was standing in for
the long tail of ~386 customers. Modelled as a tail now, and the seed computes
its own concentration with the same arithmetic the API uses.

---

## ~~5. The credit limit could not change~~ — closed

No assessment was ever written outside the seed, and no job recomputed one.
`/credit/assessment` recomputed for display while the stored `limitAmount`
stayed exactly where the seed left it — so the number a borrower read and the
number they could draw against had no mechanism keeping them together.

`AssessmentService` is now the only thing that may set a limit. `compute`
decides; `reassess` decides and records. The borrower's own credit screen
delegates to `compute`, so display and enforcement are the same computation.

Triggered three ways, per PRD §16.6: on the 14-day schedule during settlement,
on a material revenue change during ingestion (10% of eligible), and on
operator demand. A RESTRICTED or DEFAULTED borrower keeps the limit their
status imposed — an assessment must not hand credit back to a borrower a risk
decision just took it from.

The cadence counts **settlement days**, not wall-clock: a keeper paused for a
month has not observed a month of revenue, and assessing as though it had would
underwrite against data that was never settled.

**A bug this exposed.** `normalizeRevenue` — PRD §13.2's time-weighted,
median-clamped base, the control whose stated purpose is that "raw revenue is
trivially inflated by a single spike day" — existed in `@rivora/core`, was
tested, and was never called. The parameter named `normalizedRevenue30d` was
being handed a raw sum. Ingesting one outsized day moved the limit exactly as
§13.2 predicts if the clamp is skipped.

Also fixed: `concentrationBand` read HHI as a fraction while everything else
used the conventional 0–10,000 scale, so an HHI of 653 reported as HIGH.

---

## ~~6. The chain layer is a scaffold, not an integration~~ — closed, live-fired on Arc testnet

**Where:** [apps/api/src/chain/arc-chain.service.ts](apps/api/src/chain/arc-chain.service.ts)

The signer decision was made — a **Circle Developer-Controlled Wallet** — and
the layer was built around it. The API holds an API key and an entity secret;
Circle holds the private key; no key material ever touches the process.

What exists now, none of which did when this entry was written:

- **The money paths call the seam.** A draw broadcasts `Manager.draw`, a
  manual repayment and the daily settlement route broadcast `Manager.repay`,
  and the transaction hash on the ledger row is whatever came back. In ledger
  mode the same call sites get the deterministic stand-in — the services
  cannot tell which implementation they have, which was the point.
- **`submitAssessment` exists and is wired.** After a reassessment commits,
  arc mode signs the assessment as EIP-712 typed data (the registry's exact
  domain and typehash), reads the borrower's nonce from the chain rather than
  counting locally, and submits. PRD §36 criterion 5 now has a call site. A
  failure is loud but not fatal: the ledger record stands and the next
  reassessment retries the export.
- **Boot refuses loudly.** `CHAIN_MODE=arc` without the contract addresses
  *and* all three Circle credentials names what is missing and stops.
- The wire format is pinned by tests against a fake signer: calldata
  signatures, 6-decimal integer amounts, tier indices, the borrower-id
  derivation (`keccak256(handle)`, byte-identical to the Foundry suite's).

**Live-fired 2026-08-04.** The admin ran `arc-grant.mjs` (the one human step:
underwriter grant + borrower registration), then the whole loop ran against
the real testnet:

- The Circle wallet deposited 10 USDC of vault liquidity
  (`arc-ops.mjs fund`, tx `0xa6e1e132…9d7eda`).
- An operator-requested reassessment through the HTTP API signed and
  submitted a real assessment — score 74, limit 2,440 USDC, registry nonce
  0 → 1 (tx `0xac647441…7338d8`). The EIP-712 domain and typehash matched
  the deployed registry first try, which is what the wire-format tests were
  for.
- `syncLimitFromRegistry` adopted it; the borrower left OBSERVATION for
  ACTIVE onchain (tx `0xb78b07e0…adcb58`).
- A borrower draw of 3 USDC through `POST /credit/draw` broadcast
  `Manager.draw` (tx `0xe077f787…fff1bc`). Vault 10 → 7 USDC; operating
  wallet +3. The activity feed shows the real hash.

The stack runs arc mode with
`docker compose --env-file .env --env-file apps/api/.env up -d`; plain
`docker compose up` still gives ledger mode, and the smoke suite belongs to
ledger mode only — 122 API calls broadcasting real transactions would be a
gas bill, not a test.

`distributeRevenue` still refuses, correctly: no revenue router is deployed,
because whether nanopayment proceeds can settle into one is item 8's open
question. Reconciliation (item 7) is what makes the rest trustworthy — until
it exists, a transaction that lands onchain but fails to write back is only a
log line.

---

## ~~7. No indexer reconciling the database against chain events~~ — closed

**Where:** [apps/api/src/chain/indexer.service.ts](apps/api/src/chain/indexer.service.ts)

`IndexerService` polls the three deployed contracts' events — one `getLogs`
per tick, because the public RPC is rate-limited and offers no subscription
guarantees — decodes every event the contracts can emit, and records each in
`ChainEvent`. The `ChainSync` cursor advances in the same transaction that
records the batch, so a crash resumes exactly where it stopped; a replayed
log is absorbed by the `(txHash, logIndex)` unique key. `/health` carries the
cursor beside the tip, so a stalled reconciler is visible from outside.

An earlier version of this entry claimed money rows "already carry
`txHash` / `blockNumber` / `confirmedAt`". They did not — only `txHash`
existed. Fixing that surfaced a second inaccuracy: the schema had drifted
past the migrations (development had used `db push`), so a fresh
deployment's `migrate deploy` would have built an incomplete database. The
drift is now folded into migration `2_ingestion_and_quorum`, with the chain
tables as `3_chain_indexer`.

**Divergence is an alarm in both directions, never a silent patch.** A money
event with no ledger row carrying its hash raises an ops alert; a ledger row
whose real-looking hash never appears onchain (after a grace window, alerted
once) raises the opposite one. Bookkeeping events — `InterestAccrued`,
`StatusChanged`, `LimitUpdated` — are stored for audit but never judged.
Ledger-mode stand-in hashes (the `…` ones) are excluded by shape.

**Verified against the real chain, including a real divergence.** Pointed at
the live-fire block range, the indexer recorded all six historical events and
flagged four as unmatched — correctly, because a reseed had wiped the
activity rows for those genuine movements. The seed erasing history the
chain still remembers *is* the split-brain this exists to catch, and the
first thing the reconciler ever did was catch one. A fresh assessment export
(tx `0x396c1ce0…883d39`) then reconciled as **matched** within one tick.

Worth knowing: reseeding a database in arc mode will always produce
unmatched alarms for prior real transactions. That is the truth being told —
the fixture ledger does not record movements the chain remembers.

---

## ~~8. Per-payer attribution through net batch settlement~~ — priced; one question left for Circle

PRD §11.7 items 4–5, and PRD §42.2.

**What the research established** (Circle Gateway/Nanopayments docs, Aug 2026):

- Per-authorization visibility exists *structurally* at the sell side. In the
  x402 flow the seller verifies each EIP-3009 authorization itself, and a
  `TransferWithAuthorization` message carries the payer's address and their
  signature by construction. The payee's stack sees every payer, per request,
  with cryptographic authenticity — the optimistic assumption was not
  baseless.
- But that feed is **seller-side, not Circle-side**. Settlement credits the
  seller's Gateway balance net; neither the Nanopayments docs nor the Gateway
  API index list a seller-scoped authorization report or batch breakdown. So
  an underwriter consuming only Circle's data cannot compute `D` and `C`, and
  an underwriter consuming the borrower's own authorization log is trusting
  borrower-run infrastructure — self-reported diversity, sybil-inflatable.

**What the code now does about it.** The engineering flaw behind this entry
turned out to be worse than "assumes the optimistic answer": revenue ingested
*without* a payer breakdown raised the eligible base — and with it the limit —
while contributing nothing to concentration. Money with no known source was
priced as carrying no concentration risk.

The presumption is now inverted
([apps/api/src/ingest/attribution.ts](apps/api/src/ingest/attribution.ts)):
**eligible revenue no payer row explains is priced as one presumed payer.**
Zero attribution collapses to one payer holding 100% — HHI 10,000, `D` and
`C` driven to zero, the advance rate reduced — exactly the degradation §42.2
prescribes; full attribution reproduces the old numbers to the digit; partial
degrades continuously between them. Better data buys a better limit, and only
better data does. `attributedPct` rides on the revenue window so every
surface can say how much of the base is actually explained. The seed now
calls the same function rather than copying its arithmetic, and a corrected
day that arrives without payers clears the stale breakdown instead of
attaching one reading's payers to another reading's total.

Verified live against the running stack: 100% attributed baseline → an
unattributed day drops coverage to 96.79% and adds the presumed payer → a
corrected re-post restores 100%.

**Still open, and precisely one question for Circle:** does Gateway expose
(or plan) a seller-scoped API listing settled authorizations — payer address,
amount, timestamp, batch — attested by Circle, such that a third party the
seller authorises can compute payer concentration without trusting the
seller's own logs? Until the answer is yes, attribution-grade underwriting
requires either Rivora operating the x402 verifier in the request path, or
accepting borrower-attested logs at a reduced advance rate — which is what
the formula now prices.

---

## ~~9. Declaring a default is single-signature~~ — closed

Declaring is now propose → approve → commit. `POST /risk/defaults/declare`
opens a pending `DefaultDeclaration` carrying the proposer's signature and
commits nothing; `POST /risk/defaults/:id/approve` adds a signature, and the
permanent record is written only when the quorum is met.

Uniqueness on `(declaration, operator)` is what makes two signatures mean two
people rather than one person twice — the proposer approving their own
declaration is refused. A second *proposal* against the same borrower is
refused rather than merged: merging would attach a signature to figures the
second operator never read.

The commit is one transaction — record, DEFAULTED credit line, realised vault
loss and audit rows land together or not at all. The declared principal is
re-validated at commit, because settlement repays principal daily and the
balance can move between signatures.

A second operator is seeded (`dev-session.mjs ops2`), since a quorum nobody can
complete is a lockout. Ten smoke checks cover the flow and its refusals.

---

## 10. Contracts are unaudited

`RivoraCreditVault` holds liquidity-provider funds. It has 48 passing Foundry
tests including fuzz and differential tests against `@rivora/core`, and none of
that is a substitute for an audit.

---

## ~~11. Two default-related screens invent the balances they reason about~~ — closed

**Declare** reads `?handle=`, loads that borrower, and runs the loss waterfall
over their actual principal, accrued interest and reserve against the live
first-loss tranche and protocol reserve. The triggers are measured rather than
asserted — and the two that need a time series this console does not load read
as *unknown* rather than as *not fired*, because "no" and "not checked" are
different answers and only one is safe to act on.

**Recovery** reads the borrower's own record from the public default registry.
Outstanding-at-default and recovered come from the record; the daily recovery
rate is the 50% recovery share against live revenue. A borrower with no default
sees an honest empty state instead of a fabricated cure in progress.

Both branches verified in the browser: the empty state, the populated state,
and the already-defaulted guard.

---

## ~~12. Revenue seasoning is not applied~~ — closed

`AssessmentService.compute` now drops the most recent
`UNDERWRITING.seasoningDays` settled days before underwriting, and widens the
query so the window still fills.

The stronger property, and the one the tests assert: an unseasoned day is not
merely clamped, it is **absent**. A 50,000 USDC day that settled yesterday
moves the limit by exactly nothing. Once it seasons it counts — through the
median clamp, not raw.

Seasoning is measured in settled days rather than wall-clock, for the same
reason the assessment cadence is: this book runs on the settlement clock.
Seasoned days still appear on the revenue screen, because showing what settled
and lending against it are different questions.

---

## Smaller items

- **The endpoint probe reports against stored state.** `verifyEndpoint` returns
  a staged log built from what the database already knows rather than making a
  live outbound request. The network probe needs egress rules and a timeout
  budget before it can run in production; the function's docstring says so.
- **Subsidy paid-in is approximated.** `VaultService.economics` computes it
  from the current rate over current assets rather than from booked subsidy
  payments, because subsidy payments are not ledger rows yet.
