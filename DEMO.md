# The three-minute demo

A timed script for presenting Rivora live or on camera — PRD §37 adapted to
what is actually deployed. Eight beats, one claim: **repayment is plumbing,
not a promise.** Arc Testnet, x402 and the Circle SDK each get their named
moment.

---

## Pre-flight (15 minutes before)

Nothing below is optional; every recorded failure is one of these skipped.

1. **Reset the book** so the numbers match this script:
   ```bash
   ssh nitin@34.63.248.63 'cd ~/rivora && sudo docker compose run --rm migrate'
   ```
2. **Prepare four browser tabs**, in order:
   - **Tab 1** — https://rivora.hyperemblem.com (landing, signed out)
   - **Tab 2** — signed in as the **Borrower** (`0x7099…79C8`), parked on **/revenue**
   - **Tab 3** — same borrower session, parked on **/credit**
   - **Tab 4** — signed in as the **Risk operator** (`0x90F7…b906`), parked on **/risk/anomaly**
   - Sign-ins survive refresh but not a closed tab — keep them open.
3. **Terminal ready**, command pasted and tested once:
   ```bash
   node apps/api/scripts/x402-agent.mjs 3 https://api-rivora.hyperemblem.com/api/v1
   ```
4. **Arcscan ready**: one tab on the deployed vault
   `https://testnet.arcscan.app/address/0x78f34df804f71074cf6fbb4d6570593c1cb8e275`
   (addresses in [contracts/deployments/arc-testnet.json](contracts/deployments/arc-testnet.json)).
5. **Rehearse once end to end, then reset again.** Rehearsals dirty the
   public book.

Fallback if the network dies mid-demo: the local stack
(`docker compose up -d && pnpm dev`) runs this identical script at
`localhost:3000`.

---

## The script

### 0:00 – 0:25 · What Rivora is, and the problem — Tab 1, landing

**Do:** open on the hero, then scroll slowly to the live-state tiles.

**Say:**
> "**Rivora is a stablecoin-native credit protocol on Arc** — working
> capital for businesses that are software: AI APIs, MCP servers,
> autonomous agents. Here's why they need it. This is QuoteStream — an AI
> market-data API earning fourteen thousand dollars a month in sub-cent
> USDC payments. It has revenue, customers and margin — and no bank
> account, no credit file, no collateral. No lender on earth will
> underwrite it. Rivora does, from the one thing it *can* prove: revenue
> the protocol observes onchain. And every number on this page is the live
> book — including our 15.6% default rate. We publish the unflattering
> numbers on the same surface as the ones that flatter us."

### 0:25 – 0:45 · Machines paying machines — terminal, then Tab 2

**Do:** run the prepared command; while it prints `402 → sign → 200` three
times, switch to Tab 2 (**/revenue**) and refresh.

**Say:**
> "Here's where that revenue comes from — this is **x402 with Circle
> Nanopayments**. An agent requests a paid resource, gets HTTP 402 Payment
> Required, signs a USDC payment authorization, and is served — three
> purchases in three seconds, each a real EIP-3009 signature the API
> verifies with single-use nonces. And there it is, landing in the
> underwriting window, with the payer as a pseudonym — the lender sees the
> revenue, never the customer list."

### 0:45 – 1:10 · Underwriting that explains itself — Tab 3, /credit

**Do:** point at the score, then scroll to the constraint ladder.

**Say:**
> "The protocol scores what it observed — settlement success, uptime,
> refunds, customer concentration. Nothing is self-reported; a borrower who
> could report their own reliability would be setting their own limit. Score
> 74, Standard tier, 2,560 dollar limit — and this ladder shows every
> candidate limit with the one that actually binds. A borrower told only
> the final number optimises the wrong thing. This one is told exactly
> what's holding it back."

### 1:10 – 1:40 · Borrowing inside a policy — Tab 3

**Do:** click **Borrow USDC**, type `100`, pick category **Compute**, pause
one beat on the checks panel, then request. Leave the receipt on screen.

**Say:**
> "A draw runs nine checks server-side, live — capacity, vault buffer,
> exposure cap, the endpoint binding probe, and the agent spending policy:
> this money can buy compute, and cannot buy what the policy blocks. One
> hundred dollars, funded in under a second, into the registered operating
> wallet only."

### 1:40 – 2:05 · Repayment nobody remembers — Tab 3, dashboard

**Do:** close the receipt, show the revenue-allocation panel; flip briefly
to Tab 1's **/activity** feed showing the draw.

**Say:**
> "Now the part that makes this lendable: the borrower never writes a
> repayment check. Customers pay a revenue router, and every settled batch
> splits at that moment — twenty percent repays the loan, two percent funds
> a loss reserve, seventy-eight percent reaches the borrower. A slow week
> means a smaller payment, not a missed one. And every movement you just
> watched is already on the public feed."

### 2:05 – 2:30 · Arc Testnet and the Circle SDK — arcscan tab

**Do:** show the vault contract on arcscan.

**Say:**
> "The custody layer is four Solidity contracts deployed on **Arc Testnet**
> — chosen because USDC is the native gas asset and finality is
> sub-second, so credit, revenue, repayment and gas are one asset. They
> were deployed through **Circle Contracts** and every transaction is
> signed by a **Circle Developer-Controlled Wallet through the Circle
> SDK** — the server holds credentials, Circle holds the key, and no key
> material ever touches the process. We live-fired the whole loop onchain:
> assessment export, draw, and revenue split twenty-two-seventy-eight
> through the router. The demo you just saw runs in ledger mode, because
> broadcasting value is a flag we set deliberately, not a default."

### 2:30 – 2:50 · Bad faith, not bad luck — Tab 4, /risk/anomaly

**Do:** show the anomaly evidence screen; flip to **/defaults** on Tab 1.

**Say:**
> "And when a borrower manufactures revenue — pays itself through fresh
> wallets to look bigger — unattributed money is priced as one suspicious
> payer, the limit falls, and a confirmed finding restricts the account
> with the evidence recorded: funding graph, seven signals, each with its
> threshold. Defaults need two operators to sign, and the registry is
> permanent — curable, never deletable."

### 2:50 – 3:00 · Close — Tab 1, landing

**Say:**
> "Earn, score, borrow, repay — then borrow more. A credit and reputation
> layer for businesses that are software. Rivora, on Arc."

---

## The named-technology checklist

Said out loud, in this order — if one is missing, the beat above tells you
where it belonged:

- [ ] **Arc Testnet** — beat 6 (native-USDC gas, sub-second finality)
- [ ] **x402 / Circle Nanopayments** — beat 2 (402 → EIP-3009 → served)
- [ ] **Circle SDK / Developer-Controlled Wallets** — beat 6 (Circle holds
      the key; also Circle Contracts for deployment)
- [ ] **USDC** — everywhere; say it at least once as "the only asset in the
      system"

## After recording

Reset the book again — the draw from beat 4 is still on the public feed:

```bash
ssh nitin@34.63.248.63 'cd ~/rivora && sudo docker compose run --rm migrate'
```
