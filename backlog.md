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

## 10. Contracts are unaudited — still open, but no longer unreviewed

`RivoraCreditVault` holds liquidity-provider funds. An external audit is the
only thing that closes this entry, and nothing below is a substitute for one.

**What was done instead, because it was worth doing anyway:** an adversarial
internal review, and the readiness package an audit asks for on day one —
[contracts/AUDIT.md](contracts/AUDIT.md): scope, 14 stated invariants, the
trust model role by role, the internal findings, and the known-and-accepted
list.

**It found a critical bug in the exit queue.** `claimQueued` zeroed the
funded counter and left the claim naming its full original amount, so a
partially funded exit looked untouched to the next funding pass: it was
funded again and could be claimed a second time. A liquidity provider who
claimed a partial exit and waited for the next repayment withdrew more than
they were owed, out of everyone else's liquidity. No special access needed —
partial funding is the ordinary path for any exit above the buffer floor.
`test_partialClaimCannotBePaidTwice` pays out 60,000 USDC on a 50,000 claim
against the unfixed contract.

A second finding beside it: funding read the whole balance, including money
already promised to earlier entries and not yet withdrawn, so two providers
could be promised the same dollars. Both are fixed, with tests. Suite is 51.

**The deployed testnet instances still carry both.** They were deployed
before the fix. Exposure is nil today — `queueLength() == 0`, no exit has
ever queued — but the live vault must be treated as vulnerable the moment
anyone queues one. Redeploying needs the admin wallet to re-grant
`UNDERWRITER_ROLE` and re-register borrowers, so it is a deliberate step, not
a background one.

**What an audit should still buy:** a stateful invariant campaign (the
invariants are written down but only unit-tested), the paths this review
reached for and could not falsify, and everything a fresh adversary sees that
the author cannot.

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

## ~~13. A PRD audit found working screens over logic that was never built~~ — closed

Every entry above item 12 was something I noticed while building. This one
came from auditing [PRD.md](PRD.md) section by section against the code, and
it found more than the backlog knew about. The distinction matters: "the
backlog is clear" only ever meant "clear of what I had already noticed."

The money spine is real — ingestion, underwriting, draw, repay, settlement,
the vault, the contracts live-fired on Arc. What follows is the part that
renders convincingly and does nothing.

**Risk monitoring (§22.7) — one of nine requirements has a detect-and-act
loop.** Periodic reassessment works. Nothing else does: no detector for
revenue decline, failure-rate increase, concentration *change*, or suspicious
payer patterns. The `Anomaly` table is written in exactly one place, and it
is `seed.ts`. No runtime path can set `RESTRICTED` or `WATCH` — the only
status the API ever writes is `DEFAULTED`, through the manual quorum. And
`repaymentBps` is never escalated; its only runtime write *resets it down* to
2,000.

So PRD §35.3 — the scenario the PRD itself calls "the scenario worth
demonstrating… the harder and more relevant claim" — cannot run. Manufactured
revenue detected, limit to zero, draws blocked, repayment escalated to 35%,
status RESTRICTED: all of it is a seed fixture. §36 criterion 14 fails with
it.

**Agent spending controls (§22.8) — none of the six are enforced.** Max
payment, daily cap, allowlist, categories, blocked contracts, human-approval
threshold: stored, displayed, editable over the API, consulted by no
enforcement code. `CreditService.draw` never loads the policy; `category`
reaches it only as a log string. `spentToday` is never incremented.
`PolicyDecision` rows exist only in the seed, so the audit log is permanent
fiction — against a schema comment that says "a policy nobody can audit after
the fact is indistinguishable from no policy." The Save button has no
`onClick` and `PATCH /policy` has no caller.

**The Revenue Router is never deployed or called.** Written and tested,
absent from `deployments/arc-testnet.json`. `deployRouter` in the web store
sets a local boolean; `routerAddress` is written by no code outside the seed.
§36 criteria 9 and 11 fail, and the thesis — repayment taken *before* the
money reaches the borrower — is currently repayment after, by direct call.

~~**Endpoint verification returns `verified: true` unconditionally.**~~ —
closed. The probe
([apps/api/src/borrower/endpoint-probe.ts](apps/api/src/borrower/endpoint-probe.ts))
now makes a real request: resolves the host, requires HTTPS, expects a 402,
reads `payTo` out of the challenge and compares it against the deployed
router. The result is written to `bindingOk`, so a diverted `payTo`
restricts the borrower rather than producing a log nobody reads.

Making it real made it an SSRF surface — the URL is chosen by the borrower,
so the API is being asked to fetch an address from outside itself. Loopback,
link-local and every private range are refused *before* the request leaves,
redirects are not followed, and the whole thing runs under a 5s timeout.
`https://169.254.169.254/` is cloud metadata: without that check the probe
is a credential exfiltration tool a borrower aims by registering a URL.
Twelve tests, most of them refusals.

The self-clear half was closed earlier: `restoreBinding` now refuses
anything but a binding restriction.

**Two confirmed bugs.** The withdrawal fee is destroyed rather than retained:
the provider is paid `immediate - fee` while `totalAssets` falls by the full
`immediate`, so the fee accrues to nobody — contradicting both the UI copy
and `RivoraCreditVault.sol`, which keeps it. ~~And the LP queue position is
the literal string `#1`~~ — closed: the exit panel reports what is actually
ahead of the position and an estimated clearance in settlement days, from
the `queueClearanceDays` that had sat unused in `@rivora/core` since the
vault was written. With several providers it overstates the wait, because
the database models the queue as one row per provider rather than as ordered
entries — the Solidity keeps a real FIFO array and this does not.
Overstating is the direction to be wrong in, and the panel says so rather
than presenting the estimate as exact.

**Scorecard at audit time:** §36 acceptance criteria 11/15; §35.4
must-include 11/14 (no x402 paid API, no AI-generated explanation, no
router); §22.7 1/9; §22.8 0/6.

**What was closed, and how.** The exit fee is kept rather than destroyed.
Detection is real: circular funding restricts, revenue collapse and
concentration jumps freeze new draws, and the PRD §35.3 scenario now runs end
to end — verified against a live stack, ACTIVE/2530/2000bps to
RESTRICTED/0/3500bps with the draw refused and the anomaly written. The
spending policy is enforced on every draw, refusals recorded in their own
transaction so they survive the rollback they cause. Two holes closed
alongside: a borrower could clear a risk restriction by repairing an
unrelated endpoint, and the draw dialog told every borrower their category
was permitted while nothing checked.

**What remains: the router is deployable but not deployed** — item 14.

---

## ~~14. The Revenue Router is built and unbound~~ — closed, routing onchain

Everything code-side existed: the contract, a per-borrower deployment script
(`circle:deploy-router`), `ARC_REVENUE_ROUTERS` configuration, and
`distributeRevenue` calling the real thing instead of refusing. It has not
been run, because the last step needs a key that deliberately does not live
on this machine.

**A gap found while wiring it.** `registerBorrower` was the only place a
borrower's router could ever be set, and it reverts on an existing account —
so a router that had to be replaced, upgraded or compromised, stranded that
borrower with the original forever. `setRevenueRouter` now rotates it under
`RISK_ROLE`, revoking the old router's authority in the same call that grants
the new one's; leaving it able to book repayments would mean a replaced
router could still credit debt it no longer collects.

**Step 1 is done: the protocol was redeployed on 2026-08-04.** The Circle
wallet signs the deployment and the handover, so no human key was needed.

```
RivoraCreditVault    0x78f34df804f71074cf6fbb4d6570593c1cb8e275
RivoraCreditManager  0x0735cfdf5b661092bbd50765e1e50cc0a4ff8eed
RivoraRiskRegistry   0xec8b8e26488cfe023070efe806569c11f85cb5bc
```

Every role was verified onchain afterwards, one read at a time: the manager
holds `CREDIT_MANAGER_ROLE` on the vault, the underwriter holds
`UNDERWRITER_ROLE`, the admin holds `DEFAULT_ADMIN_ROLE` and `RISK_ROLE`
everywhere, and `hasRole(DEFAULT_ADMIN, deployer)` is false on all three —
the deployer renounced as intended.

The deploy script itself exited non-zero: the public RPC rate-limited its
verification reads, which run *after* the last transaction, so it never
wrote `deployments/arc-testnet.json`. The addresses were recovered from
Circle's own contract list and the file written by hand. Worth fixing —
verification should back off and retry rather than treat a rate limit as a
failed deployment.

Roughly 9 USDC of the Circle wallet's shares are stranded in the old vault.
Testnet, so it is a note rather than a problem.

**Step 2 is done: the router is deployed** at
`0xeefda804d1f8ce675479d3b935e34b2052863685`, verified onchain to carry the
right `borrowerId`, both protocol addresses and the 20/2/78 split.

Getting there cost three rejected attempts, because Circle answers every
malformed deploy with the same bare `400 API parameter invalid` naming no
field. Two things were wrong and the error could not distinguish them: the
contract *name* may not carry non-ASCII (the handle holds an ellipsis) and
may not be long — `Rivora RevenueRouter 0x9c4e-a7f1` is rejected where
`Rivora RevenueRouter` is accepted. A third "fix" made it worse: uint256
arguments must be JSON numbers, and sending them as decimal strings is
rejected the same way. The bisect that settled it is worth keeping in mind
for any future SCP work — vary one field, deploy, repeat, because the API
will not tell you.

**Closed 2026-08-04: revenue routes through the router onchain.** The
borrower was registered with the router bound at registration — cheaper than
a second admin transaction, and `setRevenueRouter` stays for what it was
built for, rotating a router that already exists. The whole loop then ran:

```
assessment exported     0x7e3c3bea…60eff
limit adopted           0x5948b18d…11a7c   → 2,440 USDC, ACTIVE
draw 5 USDC             0x556d256d…ee03a   → vault 12 → 7
2 USDC revenue → router 0x724295f4…9f69d
distributeRevenue()     0x143b0b01…1f904
```

The split: vault **+0.40** (20%), reserve and operating **+1.60** between
them, router left holding **zero** — the three parts sum to exactly the
input, which is what `splitRevenue` computing the operating share as a
remainder is for. Reserve and operating are the same address on testnet, so
their shares land together.

And the debt moved: principal **5.000 → 4.600** onchain, the manager having
booked the routed repayment through `ROUTER_ROLE`. That is PRD §36 criteria
9, 10 and 11 — revenue enters the Router, it repays automatically, the
borrower receives the remainder — true onchain rather than in the ledger.

**A mistake worth recording.** `arc-ops.mjs` had the contract addresses
hardcoded, so the first `fund` after redeployment paid 10 USDC into the
*previous* vault. Nothing failed: the deposit succeeded, the balance read
looked plausible, and the money went somewhere nothing points at. A contract
address that outlives its deployment is the most convincing kind of wrong
value, because every call against it still works. Recovered by withdrawing
the position from the old vault — which incidentally exercised the exit
queue against a real deployment: 19 USDC requested, 14 served immediately
and 5 queued behind the buffer floor, exactly as `planWithdrawal` says. The
script now reads `deployments/arc-testnet.json`.

---

## ~~15. Revenue was never originated, only ingested~~ — closed

PRD §36 criterion 1 and §35.4 both ask for an x402-compatible paid API, and
there was none. Revenue arrived through `POST /ingest/revenue` — real
ingestion, simulated origination. It stayed open because every request until
now was about the *lender*, and the paid endpoint is the *borrower's*
service.

`GET /api/v1/x402/quote` now charges for itself. An unpaid request gets a
**402** with an x402 challenge; a retry carrying an `X-PAYMENT` header is
verified and served. What is real: the challenge, the EIP-3009
`TransferWithAuthorization` signature check, single-use nonces, and the
revenue landing in the underwriting window through the same ingestion path
an indexer would use.

What is not real, stated in the code rather than implied: **settlement**.
Gateway batches authorizations and settles them onchain; a seller serves on
the strength of the signature, which is the premise nanopayments rest on and
is not the same as money having moved.

**Verified live**: four purchases by `apps/api/scripts/x402-agent.mjs`, each
402 → sign → 200; a replayed authorization refused with `nonce_used`;
takings 4 requests / 0.16 USDC / 1 payer, paid to the deployed **Revenue
Router**. The revenue reached `RevenueDay` as 0.16 across 4 requests, and
the payer appears on the revenue surface as `payer-x51a2ac` while the wallet
stays in `X402Payment` (PRD §21).

**Two things this exposed.** The seeded `routerAddress` was `0x7f3a…c1d2` —
a truncated *display* string, fine on a screen and unusable as a payment
destination. The endpoint advertised it, and every agent failed at the
signing step with an error about the address rather than about the seller.
The seed now carries the real router, and the service refuses to sell at all
rather than advertise an unpayable `payTo`.

Ingestion also needed a second write path. The batch path *replaces* a day,
because a re-posted indexer batch is a corrected reading; a live payment is
one more event on a day in progress, so `recordPayment` increments.
Collapsing the two would make either a retried batch double-count or a
second payment erase the first.

---

## ~~16. Reliability was a fixture the protocol scored itself against~~ — closed

The last of PRD §22.7's nine. `successPct` and `refundRatePct` fed factor S
and the score, and **no runtime path ever wrote them** — they came from the
seed and stayed there, so the protocol was underwriting a service whose
failures it had no way to observe. There was nothing to observe them with
either: ingestion carried `settled` and `requests` and no notion of a request
that failed.

Ingestion now carries `failed` and `refunded`, reliability is recomputed from
the window on every batch, and a failure-rate detector freezes new draws —
below a 90% fulfilment floor, or on a 5-point drop from a healthy level.

**The first attempt was wrong in the flattering direction**, which is the
one that matters. The columns defaulted to `0`, so a day that reported
nothing about failures was indistinguishable from a day that reported none.
Ingesting one bad day against twenty-nine silent ones pushed measured
success *up* — 96.2% to 99.4% — because the silent days averaged in as
perfect. They are nullable now: `0` is a reported clean day, `null` is
silence, and reliability is computed only over days that reported. The seed
carries failure counts consistent with the 96.2% it asserts, so the fixture
no longer contradicts itself.

Verified live: ten days ingested at ~52% fulfilment moved measured success
96.2% → **81.4%** and the borrower ACTIVE → WATCH, which blocks draws.

Still a fixture, and honestly so: `uptimePct` and `coverageRatio`. Uptime
needs a monitoring loop the protocol does not run — the endpoint probe
observes a single moment, not availability over time. Coverage needs routed
revenue measured against total, which needs the router to be the only way
revenue arrives.

---

## ~~17. The last two PRD gaps~~ — closed

**AI-generated decision explanation** (§35.4). There was none, and the
deterministic constraint ladder stood in for it. Now
[explanation.service.ts](apps/api/src/assessment/explanation.service.ts)
narrates a decided assessment in plain language — after the limit is
computed, stored and enforced.

§6.5 is the governing constraint: *AI may analyse risk, but deterministic
policies must control funds.* So the wiring, not the prompt, is what makes
this safe — the model receives a settled outcome and the only thing written
back is prose. It is optional throughout: with no key the explanation is
absent and every surface falls back to the ladder, which is the actual
record. An underwriting decision must not depend on a third party being
reachable, so a failure loses a sentence rather than a decision.

Routed through **OpenRouter** rather than a single vendor's SDK. One key
reaches many models, so changing which one narrates is a config change
instead of a dependency change — and the protocol should not be coupled to
one inference provider for a cosmetic feature. The API is OpenAI-compatible,
so `fetch` is the entire client and there is no SDK in the dependency tree at
all. `EXPLANATION_MODEL` must be a slug OpenRouter serves; one they do not
comes back 400 and the explanation is simply absent, logged rather than
silent.

**Reasoning models need room, and the first symptom is silence.** Running
this against `qwen/qwen3.7-flash` produced a 200 with `content: null` and
`finish_reason: "length"` — a successful call containing nothing, which
looked exactly like "no key configured". The token budget was 350, sized for
the three sentences the prompt asks for; the model spent all of it thinking.
Measured rather than guessed: a trivial prompt finishes on ~1,000 reasoning
tokens, the real one — whole ladder plus score components — needs well past
2,000, so the ceiling is 8,000. Output length is still governed by the
prompt. An empty completion now logs `finish_reason` and whether reasoning
was present, so this can never be silent again.

The borrower's own credit screen recomputes the ladder live while the
narration belongs to the last *decision*. It is attached only when the two
limits agree — a sentence describing a limit that no longer holds, shown
beside the new figure, would be worse than no sentence.

**Onboarding** (§22.1). Registration accepted only a service name, category,
endpoint and custody model; the operating wallet was silently the connecting
wallet and there was no revenue wallet at all. Both are now settable at
registration and validated as addresses, defaulting to the connecting wallet
when omitted. Keeping them distinct is the point: the operating wallet is
what the agent spends from, the owner wallet authorises changes, and a
service can rotate the first without renegotiating its credit.

The onboarding screen also showed `Circle Wallet · Arc Testnet · 42.10 USDC`
as a literal string — a balance belonging to nobody, displayed at the moment
a provider decides whether they can afford to proceed. It reads the connected
wallet now, and says so plainly when none is connected.

Verified live: a fresh wallet registered with distinct operating and revenue
wallets, stored correctly with the owner wallet remaining the signer; a
malformed address refused with `validation_failed`.

**Still open from §22.1, and honestly:** router deployment is a script rather
than a step in the wizard, and the wizard's `deployRouter` remains a local
flag. Making it a real step needs the deploy path to run under a borrower's
own credentials rather than the protocol's, which is a custody question
before it is a UI one.

---

## Smaller items

- ~~**The endpoint probe reports against stored state.**~~ — closed. It makes
  a real request now, refuses private address ranges before one leaves, and
  writes its verdict to `bindingOk`. See item 13.
- **Uptime is still a fixture.** `ServiceHealth.uptimePct` feeds the score and
  is written only by the seed. It needs a monitoring loop the protocol does
  not run — the endpoint probe observes one moment, not availability over
  time. That is an infrastructure decision, not a missing function.
- ~~**Routed coverage is a fixture.**~~ — closed. `coverageRatio` is now
  measured: `RevenueDay.routed` records the portion of a settled day that
  arrived through the Revenue Router, `recomputeCoverage` divides routed by
  settled across the reporting window, and the detector watchlists a borrower
  below 0.90 or falling 5 points. Nullable like the reliability columns, for
  the same reason — a service that never reports routing must not be scored
  as though every cent were routed. x402 revenue is credited as routed by
  construction, because the challenge names the router as `payTo`.

  The indexer watches every configured router for `RevenueDistributed`, but
  deliberately does not write `routed` from it: x402 credits the money when
  it settles and the router distributes that same USDC afterwards, so both
  writing would double-count, and the cap at 1.0 would hide the error. The
  onchain events serve as the independent check instead — a coverage ratio no
  distribution backs shows up as an unmatched event.

  Verified against the running stack: ten days ingested at 20% routing moved
  measured coverage 0.98 → 0.7146 and the borrower ACTIVE → WATCH.
- **Router deployment is a script, not an onboarding step.** The wizard's
  `deployRouter` remains a local flag. Making it real needs the deploy to run
  under the borrower's own credentials rather than the protocol's, which is a
  custody question before it is a UI one.
- **Subsidy paid-in is approximated.** `VaultService.economics` computes it
  from the current rate over current assets rather than from booked subsidy
  payments, because subsidy payments are not ledger rows yet.
