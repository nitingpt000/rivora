# Backlog

Known gaps, recorded rather than papered over. Each entry says what is wrong
today, why it was left, and what closing it requires.

Ordered by how much a reader is misled by the current state, not by effort.

---

## 1. Partner console states API usage counters it never measured

**Where:** [apps/web/src/app/partner/page.tsx](apps/web/src/app/partner/page.tsx)

Four figures on the partner console — score requests, unique subjects, error
rate, billable calls — are literals in the component. Nothing counts them.

Every other figure in the product now comes from a request. These do not, and
they read exactly like the ones that do.

**Why it is still open.** Backing them needs a usage table the schema does not
have: per-key request counts, distinct subjects, and outcomes, aggregated over
a billing window. Inventing a plausible-looking number would have been worse
than leaving a visibly static one — a fabricated billing figure is the kind of
thing someone reconciles an invoice against.

**To close it:**

- `ApiKeyUsage` model — `apiKeyId`, `at`, `route`, `subjectHandle`, `status`.
  Written by the same guard that authenticates the key, so a request cannot be
  served without being counted.
- Aggregate over a window rather than keeping a running total on `ApiKey`: a
  counter that only increments cannot answer "this month".
- `GET /partner/usage` returning counts for the caller's own key only.
- Decide what "billable" means before displaying it. Right now the word appears
  on screen with no definition behind it, which is its own problem.

---

## 2. `dev-session.mjs` mints sessions from public test keys

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

**To close it:**

- Refuse to run unless the target API reports a development environment —
  read it from `/health` rather than trusting an env var the caller sets.
- Keep the seeded role grants out of any non-local seed. The addresses are
  public; the grant is what matters.
- Consider moving it under `scripts/dev/` so its status is legible from the
  path, and excluding it from the production image (it is a script, so it is
  not bundled today — but nothing enforces that).

---

## 3. Money movement is a database write, not a contract call

**Where:** [apps/api/src/chain/chain.service.ts](apps/api/src/chain/chain.service.ts)

`ChainService` has both implementations. `LedgerChainService` writes to
PostgreSQL; `ArcChainService` broadcasts to Arc. `CHAIN_MODE=arc` selects the
second, and it is opt-in and fails loudly rather than falling back.

The contracts are deployed and tested against `@rivora/core` differentially,
but they hold no funds. A draw is a POST.

**To close it:** switch `CHAIN_MODE`, then reconcile — see item 4, which is the
part that actually makes it trustworthy.

---

## 4. No indexer reconciling the database against chain events

Once money moves onchain, the database becomes a read model of the chain rather
than the source of truth. Nothing currently performs that reconciliation, so a
transaction that lands onchain but fails to write back would leave the two
permanently disagreeing with no alarm.

**To close it:** an event processor subscribing to `RivoraCreditVault`,
`RivoraCreditManager` and each `RivoraRevenueRouter`, with a `ChainSync` cursor
so a restart resumes rather than replays. Money-movement rows already carry
`txHash` / `blockNumber` / `confirmedAt` for this.

---

## 5. Per-payer attribution through net batch settlement

PRD §11.7 items 4–5, and PRD §42.2.

Circle Nanopayments settles net, in batches. If the per-authorization feed is
not available to the payee's underwriter, the diversity (`D`) and concentration
(`C`) factors are not computable from settlement data at all — they would have
to be dropped from the formula and the advance rate reduced to match.

This is a question for Circle, not a coding task. It is listed here because the
underwriting formula depends on the answer and the current implementation
assumes the optimistic one.

---

## 6. Declaring a default is single-signature

PRD §33 specifies an operator quorum. `POST /risk/defaults/declare` takes one
operator's session and writes a permanent, public record that cannot be
deleted.

The gap is called out in the endpoint's own Swagger description rather than
being silently skipped, but calling it out is not the same as fixing it.

**To close it:** a pending-declaration record requiring N distinct operator
signatures before it commits, with the signatures themselves recorded.

---

## 7. Contracts are unaudited

`RivoraCreditVault` holds liquidity-provider funds. It has 48 passing Foundry
tests including fuzz and differential tests against `@rivora/core`, and none of
that is a substitute for an audit.

---

## 8. Two default-related screens invent the balances they reason about

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

## Smaller items

- **The endpoint probe reports against stored state.** `verifyEndpoint` returns
  a staged log built from what the database already knows rather than making a
  live outbound request. The network probe needs egress rules and a timeout
  budget before it can run in production; the function's docstring says so.
- **Subsidy paid-in is approximated.** `VaultService.economics` computes it
  from the current rate over current assets rather than from booked subsidy
  payments, because subsidy payments are not ledger rows yet.
