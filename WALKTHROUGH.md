# Walkthrough — sign in and tour every seat

How to log into Rivora yourself, see each role's surface, and explain what is
on screen. Works against the live demo or a local stack; every step is the
same, only the URL changes.

> **Arc Testnet. Test assets only, no real value.** The accounts below are
> the standard public Anvil development keys — everyone on the internet has
> them. They hold nothing real anywhere, and here they only open a seeded
> demo book that can be reset in one command.

**Live demo:** https://rivora.hyperemblem.com
**Local:** `docker compose up --build -d` then `pnpm dev` → http://localhost:3000

---

## 1. Set up the wallet (once, ~3 minutes)

You need any injected browser wallet — MetaMask is the reference.

1. **Add the Arc Testnet network** (MetaMask → Networks → Add network manually):

   | Field | Value |
   | --- | --- |
   | Network name | Arc Testnet |
   | RPC URL | `https://rpc.testnet.arc.io` |
   | Chain ID | `5042002` |
   | Currency symbol | USDC |
   | Explorer | `https://testnet.arcscan.app` |

2. **Import the accounts** you want to demo (MetaMask → Add account →
   Import). Each key opens a different seat:

   | Seat | Address | Private key |
   | --- | --- | --- |
   | Borrower | `0x7099…79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
   | Liquidity provider | `0x3C44…93BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
   | Risk operator | `0x90F7…b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
   | Second operator | `0x976E…0aa9` | `0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e` |
   | Partner | `0x15d3…6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

3. Signing in is always the same: open **`/connect`**, pick the wallet, and
   approve the signature request. That signature is a real Sign-In With
   Ethereum message verified server-side — the address resolves to its role
   and the app becomes that seat's surface. To switch seats, disconnect,
   change the active account in MetaMask, and connect again.

---

## 2. Start public — no wallet at all

Open the landing page signed out. The point to make: **every figure is
served by the API from the book itself**, including the unflattering ones —
the default rate on display is a real 15.6%, not marketing.

- **/activity** — the public event stream. Every money movement you make in
  the steps below will appear here, timestamped, with its transaction
  reference.
- **/defaults** — the permanent default registry. Records can be cured but
  never deleted; that non-negotiability is what makes the registry worth
  anything to a third party.
- **/reputation?handle=0x9c4e…a7f1** — the borrower's public scorecard.
  Bands, not values: a counterparty learns concentration is moderate without
  learning who the customers are.

---

## 3. The borrower — the main event

Connect with the **Borrower** account. You land on the dashboard of
*QuoteStream Market Data API*: a service with ~60 days of observed revenue,
a 2,560 USDC limit, and a live book.

Walk it in this order:

1. **Dashboard** — point at the revenue allocation panel: of every 100 USDC
   that settles, 20 repay the loan, 2 fund the loss reserve, 78 reach the
   operating wallet. Repayment is plumbing, not a promise.
2. **Credit** — the constraint ladder. Every candidate limit is shown with
   the *binding* one marked, so the borrower knows what to improve — or that
   the right move is to wait. This is PRD §14.5 made mechanical.
3. **Borrow** — click *Borrow USDC*, enter `100`. Watch the dialog run its
   checks live: status, capacity, vault buffer, exposure cap, destination,
   spending-policy category, router binding, interest coverage, payback
   horizon. Pick a permitted category (e.g. *Compute*) and request. The
   receipt shows the movement and the new position — and the draw is already
   on the public **/activity** feed.
4. **Repay** — *Repay manually*, `100`. Interest first, then principal; the
   book returns to where it was. (Doing 3 then 4 leaves the demo clean.)
5. **Revenue** — the underwriting window: eligible vs excluded revenue, every
   exclusion carrying its reason, payers as pseudonyms.
6. **Custody** — the endpoint binding probe and the routed-coverage ratio.
   This screen is the answer to "what stops revenue routing around you?"
7. **Policy** — the agent spending policy. These are the caps and categories
   the borrow dialog enforced in step 3.
8. **Alerts** — every notification the protocol sent this borrower.

---

## 4. The liquidity provider

Switch to the **LP** account and reconnect.

1. **Vault** — supplied position, share price, utilization, and the same
   loss figures the landing page publishes.
2. **Deposit** — add e.g. `1,000`; shares are minted at the current price.
3. **Withdraw** — ask for more than the buffer allows and the receipt shows
   the split: what left immediately, what queued. The queue is the run
   protection — one nervous lender cannot drain the liquidity everyone
   else's loans stand on. Queued exits are funded from incoming repayments,
   ahead of any new draw.

---

## 5. The risk operator — including the two-key default

Switch to the **Risk operator** account.

1. **Overview / Watchlist / Exposure** — the portfolio as the protocol sees
   it: concentration, coverage, capacity, and who is being watched and why.
2. **Anomaly** — the evidence bundle behind a restriction: the funding
   graph, seven signals each with observed value *and* threshold.
3. **Declare a default** (destructive — reset afterwards): pick a borrower,
   declare. Nothing commits: the declaration sits *pending* with one
   signature, and the proposer cannot approve their own. Switch to the
   **Second operator**, approve — only now does the record write, the line
   go to DEFAULTED and the loss hit the vault. Two keys, like a safe.

---

## 6. The partner

Switch to the **Partner** account.

- **Console** — the API keys this wallet owns and what they were used for:
  requests, billable calls, latency. Keys are shown by prefix only.
- **Sandbox** — score lookups against fixture profiles, free; the real
  `GET /partner/score/:handle` is key-authenticated and metered per call.

The pitch here: credit history as a product — a marketplace asks "how
reliable is this service?" and gets bands and a score, never the underlying
revenue or customers.

---

## 7. The machine-pays-machine moment (terminal, 15 seconds)

The borrower's paid endpoint is real. From the repo:

```bash
node apps/api/scripts/x402-agent.mjs 3                                          # local
node apps/api/scripts/x402-agent.mjs 3 https://api-rivora.hyperemblem.com/api/v1 # live demo
```

The script buys the resource three times: each request hits `GET /x402/quote`,
receives **402 Payment Required** with an x402 challenge, signs a USDC
`TransferWithAuthorization`, retries, and is served. Then show the revenue
landing on the borrower's **Revenue** screen and the payer appearing as a
pseudonym. Replaying the same authorization is refused — nonces are
single-use.

---

## 8. Reset the book

Anything you did — draws, defaults, rehearsals — resets to the canonical
seeded dataset in one command.

Live demo (on the VM):

```bash
ssh nitin@34.63.248.63 'cd ~/rivora && sudo docker compose run --rm migrate'
```

Local:

```bash
pnpm --filter @rivora/api db:reset
```

Reset after every rehearsal, and verify the landing page numbers before an
audience arrives.

---

## If someone asks…

| Question | The honest answer |
| --- | --- |
| "Is this onchain?" | The contracts are deployed and live-fired on Arc testnet (see backlog items 6 and 14 for the transaction hashes). The demo runs in ledger mode — money movement is a database transaction — because broadcasting value should be an explicit choice, and `CHAIN_MODE=arc` is that choice. |
| "Are these real payments?" | The x402 flow verifies real EIP-3009 signatures; settlement through Circle's batch API is the documented next step. Serving on signature strength is exactly the assurance model nanopayments are built on. |
| "What stops a borrower faking revenue?" | Unattributed revenue is priced as one payer — concentration goes to the floor, the limit falls. Confirmed manufacturing restricts the account and escalates the repayment share to 35%. Try it from the operator seat. |
| "What's missing?" | [backlog.md](backlog.md) item 19 is the production gate, in public: external audit, real settlement, legal review. The backlog is the audit trail — closed items stay struck through with what was actually done. |
