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

## 6. The chain layer is a scaffold, not an integration

**Where:** [apps/api/src/chain/chain.service.ts](apps/api/src/chain/chain.service.ts)

An earlier version of this entry said `CHAIN_MODE=arc` "selects" the Arc
implementation, which reads as though switching it would broadcast. It would
not. Two things are true and neither was written down:

- **`ArcChainService` throws on every method.** `fundDraw`,
  `receiveRepayment` and `distributeRevenue` all reject with "no signer is
  configured". It validates the contract addresses at boot and then refuses to
  do anything, which is the correct failure mode but is not an implementation.
- **Nothing calls `ChainService` at all.** The credit, vault and settlement
  services write straight to Prisma. So the ledger implementation is dead code
  too, and the transaction hashes on every screen come from
  `LedgerService.nextTxHash` — deterministic stand-ins, not Arc.

There is also no `submitAssessment` on the interface, so PRD §36 criterion 5
("the approved limit is stored on Arc") has nothing to call even in principle.

The contracts are deployed to Arc Testnet and tested differentially against
`@rivora/core`. They hold no funds and have never been called by the API.

**To close it:** decide where the signer lives — a Circle Developer-Controlled
Wallet, an HSM, a keeper — then implement the three methods plus
`submitAssessment`, and give the money paths call sites. Reconciliation
(item 7) is what makes it trustworthy afterwards.

Gated on PRD §42.2 item 1: whether an arbitrary contract can be a nanopayment
settlement destination decides the custody model, and the custody model decides
what the router is for.

---

## 7. No indexer reconciling the database against chain events

Once money moves onchain, the database becomes a read model of the chain rather
than the source of truth. Nothing currently performs that reconciliation, so a
transaction that lands onchain but fails to write back would leave the two
permanently disagreeing with no alarm.

**To close it:** an event processor subscribing to `RivoraCreditVault`,
`RivoraCreditManager` and each `RivoraRevenueRouter`, with a `ChainSync` cursor
so a restart resumes rather than replays. Money-movement rows already carry
`txHash` / `blockNumber` / `confirmedAt` for this.

---

## 8. Per-payer attribution through net batch settlement

PRD §11.7 items 4–5, and PRD §42.2.

Circle Nanopayments settles net, in batches. If the per-authorization feed is
not available to the payee's underwriter, the diversity (`D`) and concentration
(`C`) factors are not computable from settlement data at all — they would have
to be dropped from the formula and the advance rate reduced to match.

This is a question for Circle, not a coding task. It is listed here because the
underwriting formula depends on the answer and the current implementation
assumes the optimistic one.

---

## 9. Declaring a default is single-signature

PRD §33 specifies an operator quorum. `POST /risk/defaults/declare` takes one
operator's session and writes a permanent, public record that cannot be
deleted.

The gap is called out in the endpoint's own Swagger description rather than
being silently skipped, but calling it out is not the same as fixing it.

**To close it:** a pending-declaration record requiring N distinct operator
signatures before it commits, with the signatures themselves recorded.

---

## 10. Contracts are unaudited

`RivoraCreditVault` holds liquidity-provider funds. It has 48 passing Foundry
tests including fuzz and differential tests against `@rivora/core`, and none of
that is a substitute for an audit.

---

## 11. Two default-related screens invent the balances they reason about

Both compute real arithmetic over literal inputs, so the output looks derived
and is not.

**[apps/web/src/app/risk/declare/page.tsx](apps/web/src/app/risk/declare/page.tsx)** —
`OUTSTANDING = 4_200` and `ACCRUED = 38.1` are fed to `applyLossWaterfall`, so
the loss preview an operator reads *before declaring a permanent, public
default* is computed from numbers no borrower owes. The screen also ignores the
`?handle=` parameter that the watchlist, borrower detail and anomaly screens
now pass it, so it does not know which borrower it is talking about at all.

**[apps/web/src/app/recovery/page.tsx](apps/web/src/app/recovery/page.tsx)** —
`OUTSTANDING_AT_DEFAULT = 2_000` and `RECOVERED = 640` drive the borrower's own
cure-progress view. A borrower reading how much they have left to repay is
reading a constant.

This is the same class of problem as item 1 and a worse instance of it: a
fabricated figure sitting immediately before an irreversible action, shown as
justification for taking it.

**To close it:**

- Declare: read the handle, load that borrower through
  `GET /risk/borrower/:handle` — which already returns principal, accrued
  interest and reserve — and run the waterfall over those. The endpoint exists;
  only the screen is missing.
- Recovery: needs the borrower's own default record. `GET /defaults` returns
  the public registry with `principal` and `recovered` per record, but not
  scoped to the caller; either filter it borrower-side or add the record to the
  borrower surface.

---

## 12. Revenue seasoning is not applied

PRD §13.2 requires a three-day delay between settlement and eligibility, so
refunds and reversals resolve before revenue supports credit. The constant
`UNDERWRITING.seasoningDays` exists; nothing filters on it. Every settled day
counts toward the base immediately.

**To close it:** exclude the most recent `seasoningDays` from the window in
`AssessmentService.compute`. Small change, but it shifts every limit, so it
wants its own verification pass rather than being folded into another one.

---

## Smaller items

- **The endpoint probe reports against stored state.** `verifyEndpoint` returns
  a staged log built from what the database already knows rather than making a
  live outbound request. The network probe needs egress rules and a timeout
  budget before it can run in production; the function's docstring says so.
- **Subsidy paid-in is approximated.** `VaultService.economics` computes it
  from the current rate over current assets rather than from booked subsidy
  payments, because subsidy payments are not ledger rows yet.
