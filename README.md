# Rivora

A stablecoin-native credit protocol for machine businesses — an implementation of [PRD.md](PRD.md) and [screens.md](screens.md).

Rivora underwrites AI APIs, MCP servers and autonomous agents from their verifiable onchain revenue, extends a USDC credit line, and repays it automatically from a routed share of future revenue.

> **Arc Testnet. Test assets only, no real value.** Protocol state is served by the real API — NestJS, Prisma, PostgreSQL — over a seeded demo dataset. The contracts are deployed on Arc testnet and have been live-fired; the running stack keeps money movement in ledger mode until a deployment opts into `CHAIN_MODE=arc`. Wallet connection and Sign-In With Ethereum are real.

**Live demo:** [rivora.hyperemblem.com](https://rivora.hyperemblem.com) · API docs at [api-rivora.hyperemblem.com/docs](https://api-rivora.hyperemblem.com/docs)

---

## Quick start

The web app has no backend of its own — bring up the API first, then point the app at it.

```bash
pnpm install
docker compose up --build -d     # Postgres, migrations, the seeded book, API on :4000
pnpm dev                         # the app on :3000
```

`apps/web/.env.local` must carry `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` (see [.env.example](.env.example)) — without it every request goes unanswered, by design. Start at `/connect` and connect a wallet: the address resolves to a surface (borrower, liquidity provider, risk operator, partner), and an unregistered address gets onboarding.

```bash
pnpm build       # production build of every package and the app
pnpm test        # API, domain and store tests (274)
pnpm typecheck   # tsc across the workspace
pnpm lint        # eslint across the workspace
```

Requires Node ≥ 20.11, pnpm 10 and Docker. The contract suite (54 tests) needs Foundry and runs with `pnpm --filter @rivora/contracts test`.

---

## Repository layout

```text
apps/
  web/                  Next.js 15 App Router — 34 routes, 41 screens, no API handlers
  api/                  NestJS + Prisma + PostgreSQL. The real backend.
contracts/              Solidity for Arc. Foundry.
packages/
  core/                 Protocol domain logic. Pure, tested, zero dependencies.
  ui/                   Component library built on the design system.
  tokens/               The Industry design system + the Rivora application layer.
  nav/                  Role definitions and navigation. No protocol data.
  api-client/           The wire contract and a typed HTTP client for it.
  protocol-sim/         Client state (zustand) — a flattened copy of the snapshot.
  wallet/               wagmi + viem, the Arc chain definition, one `useWallet` hook.
  eslint-config/        Shared flat configs: base, react, next.
  typescript-config/    Shared tsconfigs: base, library, react-library, nextjs.
```

### Why these boundaries

The split is not decorative — each package answers a different question, and the seams are where this codebase is meant to change.

| Package | Owns | Deliberately does not contain |
| --- | --- | --- |
| `core` | Every number the PRD specifies as arithmetic: the rate curve, the quality factor, the constraint ladder, the waterfall, coverage ratios, the loss waterfall. | React, the DOM, I/O, fixtures. |
| `tokens` | Colour, type, spacing, elevation, the blueprint frame, semantic status roles. | Components, layout, product language. |
| `ui` | What a figure, a status, a check mark or a framed panel *looks like*. | Business rules, protocol constants, data. |
| `nav` | Which surfaces exist and what each role can navigate to. | Protocol data of any kind — every figure comes from the API. |
| `api-client` | The wire contract and how to ask for it over HTTP. | React, state, any screen's needs. |
| `protocol-sim` | What is on screen: a flattened copy of the snapshot, the session, and client-owned UI state. | Originating protocol state of any kind. |
| `wallet` | Connection, chain, account, balance. | Product logic, protocol state. |
| `web` | Routing, composition, layout. | Anything the packages above already decide, and any protocol figure it did not fetch. |
| `api` | Persistence, transactions, and the checks that have to hold. | Arithmetic (it calls `core`), presentation. |
| `contracts` | Custody of funds and the rules that must survive the server being wrong. | Underwriting — limits come from a signed assessment, never computed onchain. |

The rule that keeps this honest: **a screen may lay things out, but it may not decide what a number means or how it renders.** Retuning the design system should not require touching a screen.

---

## The integration boundary

The app talks to its backend over HTTP. There is no in-process stand-in: the
web app has no route handlers of its own, so `NEXT_PUBLIC_API_BASE_URL` is
required and an unset value leaves every request unanswered.

```text
screen → protocol-sim (zustand) → api-client → NestJS API → Prisma → PostgreSQL
         ^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         what is on screen        the contract  the book, and the only source of it
```

Every figure a screen renders came from a request. A screen that has not
received its data shows a loading state, never a zero — a page of plausible
figures nobody fetched is worse than an obvious nothing, because only the
second is recognisable as "not loaded yet".

Run the backend:

```bash
docker compose up --build
```

Postgres comes up, migrations apply, the canonical dataset seeds, and the API listens on `:4000` with Swagger at [localhost:4000/docs](http://localhost:4000/docs). Every route the product uses is on this server — the web app ships no handlers of its own.

See [apps/api/README.md](apps/api/README.md).

---

## Contracts

Four Solidity contracts for Arc — credit vault, credit manager, revenue router, risk registry — deployed on Arc testnet (addresses in [contracts/deployments/arc-testnet.json](contracts/deployments/arc-testnet.json)) and live-fired: real assessments exported through the registry, a real draw through the manager, real revenue split 20/2/78 through the router. See [contracts/README.md](contracts/README.md), and [contracts/AUDIT.md](contracts/AUDIT.md) for the stated invariants and internal review findings.

```bash
pnpm --filter @rivora/contracts test    # 54 tests, needs Foundry
```

**The router is pull-based, and that is a finding rather than a preference.** The PRD assumed it could be the nanopayment settlement destination, so a settling batch would call it and the waterfall would run atomically. Circle Nanopayments instead settles into the seller's **Gateway balance**; funds reach Arc only when a burn intent withdraws them, and that arrives as a plain ERC-20 transfer, which executes no code. `distributeRevenue()` is therefore permissionless and operates on the balance it holds.

The consequence is economic, not just technical: if the borrower controls the Gateway balance, repayment is behavioural rather than structural — PRD §11.2 Model C at a 25% advance rate, not Model A at 100%. Whether Rivora can hold the withdrawal right via a Circle Developer-Controlled Wallet remains the open custody question; the companion attribution question is answered — Gateway's `GET /v1/x402/transfers` lists settled authorizations with payer addresses (see [backlog.md](backlog.md) item 8).

**The Solidity is pinned to `@rivora/core` by differential tests** that run the real TypeScript and compare. The borrower sees a preview from one and signs a transaction executed by the other; if they disagree, the number consented to is not the number that ran. That test caught three genuine divergences on its first run.

What that buys today:

- **Real async everywhere.** The UI has genuine loading, error and retry states because the network hop is genuine. Integration does not discover them for the first time.
- **The boundary holds.** Capacity, status and balance checks live in the backend, not in the modal that calls it. A client-side guard is a hint; a draw that exceeds available credit is refused with `422 exceeds_available` and the dialog shows why.
- **Mutations return the whole snapshot,** not a patch, so the client either has the server's state or knows it failed. There is no merge to get wrong.
- **One flattening adapter.** `applySnapshot` is the only place the nested wire contract becomes the flat shape 41 screens read.

The API serves 59 routes under `/api/v1`; the full contract is the Swagger document at `/docs`. The load-bearing ones:

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/nonce`, `/auth/verify` | SIWE sign-in — a verified signature becomes a role-carrying JWT |
| `GET /snapshot` | One consistent read of all protocol state (session) |
| `GET /protocol/stats`, `/activity`, `/defaults`, `/reputation/:handle` | The public surface — no session required |
| `POST /credit/draw`, `/repay` | Borrower money movement, policy-checked server-side |
| `POST /vault/deposit`, `/withdraw`, `/vault/queue/claim`, `/cancel` | LP money movement and the FIFO exit queue |
| `POST /ingest/revenue` | The indexer's write side — every window aggregate is derived, never accepted |
| `GET /x402/quote` | A real paid endpoint: 402 challenge, EIP-3009 verification, revenue into the book |
| `POST /risk/defaults/declare`, `/:id/approve` | Two-operator default quorum |
| `GET /partner/score/:handle` | The metered score API, key-authenticated |
| `POST /webhooks` | Operator-registered webhook subscriptions for the ten PRD §27 events |
| `POST /settlement/tick` | Keeper hook — accrual and revenue routing |

Settlement is a keeper hook, not a user action: nothing anyone clicks moves the protocol clock.

---

## Wallet

`@rivora/wallet` wraps wagmi and viem behind one provider, one hook and one chain definition. Screens import `useWallet`, never wagmi directly, so the product has a single answer to "who is connected and to what".

```ts
const { address, isConnected, connectors, isWrongNetwork, switchToArc, balance } = useWallet();
```

Injected wallets and Coinbase Wallet need no configuration. WalletConnect is offered only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set — instantiating it without one throws at module load and takes the app down, which is a poor trade for a connector nobody can use.

**USDC on Arc has two decimal scales and they are not interchangeable:** 18 decimals as the native gas token, 6 decimals through the ERC-20 interface at `0x3600…0000`. Wallet gas balances use the first; every protocol figure uses the second. Reading one as the other is wrong by a factor of 10¹².

Chain id, RPC and explorer are environment-driven; see [.env.example](.env.example). Defaults are Arc Testnet (`5042002`, `rpc.testnet.arc.io`) and are taken from [Circle's documentation](https://docs.arc.io/arc/references/connect-to-arc), not guessed.

Address → role resolution happens server-side, from a verified signature.
`POST /api/v1/auth/nonce` issues a single-use challenge, `POST /api/v1/auth/verify`
checks the SIWE signature and returns a JWT carrying the role, and every
protected route is gated on it. A wallet with no registered service, vault
position or operator grant signs in successfully and lands on a null role —
that is a new user, not a failure.

---

## The domain package

`@rivora/core` is where the PRD's economics live.

```ts
import { calculateLimit, qualityFactor, quoteDraw } from '@rivora/core';

const decision = calculateLimit({
  normalizedRevenue30d: 13_500,
  tier: 'Strong',
  factors: { S: 0.95, C: 0.86, V: 0.9, D: 0.95, M: 0.88, G: 1.1 },
  custody: 'A',
  repaymentBps: 2_000,
  previousLimit: 1_690,
  vaultAssets: 25_000,
  historyDays: 60,
  completedCycles: 1,
});

decision.limit;       // 2530
decision.bindingKey;  // 'growthCap'
decision.ladder;      // every candidate limit, with the binding one flagged
```

Its 54 tests assert against the PRD's own worked examples — §13.11's 2,730, the MVP scenario's 1,690 and 2,530, the kinked rate curve, the waterfall's sum invariant, and the loss waterfall's ordering.

Three decisions in `core` resolve genuine ambiguities in the spec, each documented at the call site:

1. **The exposure cap is advisory on the constraint ladder**, not part of `min()`. PRD §31.5 and screens.md S-54 both measure it against *outstanding principal*, so it is a draw-time control. Folding it into the limit would silently crush limits in a small vault and contradict the ladder the borrower is shown.
2. **The new-borrower cap lifts on a completed repayment cycle**, not purely on calendar age. The cap bounds exposure to an unproven repayment loop, and a completed cycle is the proof — the same logic PRD §34.5 uses to gate cohort progression.
3. **Draw checks carry a severity.** A breached per-borrower exposure cap freezes the limit at the next assessment (S-54); it does not refuse today's draw. Blocking checks gate; advisory ones surface.

---

## The design system

`packages/tokens/src/industry.css` is vendored from the Industry design-system handoff and is **not edited by hand**. One documented change is applied on sync: the Google Fonts `@import` is stripped, because the app loads Barlow through `next/font` and re-points `--font-heading` / `--font-body` at it.

```bash
pnpm --filter @rivora/tokens ds:sync -- /path/to/unzipped-handoff
```

`rivora.css` adds only what the product needs and the system does not define: semantic status roles (`--color-ok`, `--color-warn`, `--color-restrict`, `--color-danger`), a monospace face for addresses and hashes, the layout measures, and the responsive collapse from screens.md §13.3.

See [packages/tokens/README.md](packages/tokens/README.md).

---

## Screens

41 screens across four surfaces plus onboarding and the public pages, each carrying its screens.md ID in a doc comment.

| Surface | Screens |
| --- | --- |
| Public | Landing, activity, reputation, default registry |
| Onboarding | Profile → endpoint binding → custody → costs & terms, plus the observation state |
| Borrower | Dashboard, revenue, excluded revenue, customers, credit, assessment, limit history, custody, policy, reserve, recovery, closure, notifications |
| Liquidity provider | Vault, portfolio, performance |
| Risk operator | Overview, watchlist, borrower detail, anomaly, exposure, parameters, default declaration |
| Partner | Console, score-API sandbox |

Draw, repay, deposit and withdraw are modals rather than routes — each is an action taken *against* the screen behind it, and the receipt has to land back on the same context.

### Screens worth looking at first

- **`/credit`** — the constraint ladder. Every candidate limit with the binding one marked. PRD §14.5: a borrower told only the final number will optimise the wrong metric.
- **`/custody`** — the live endpoint probe and the routed-coverage ratio. This is the screen that makes the credit legible as safe.
- **`/risk/anomaly`** — the funding graph, seven evidence signals with observed value *and* threshold, and the before/after impact of a confirmed manipulation finding.

---

## State and determinism

**No `Math.random()` in the backend or fixtures.** Transaction hashes come from a monotonic counter hashed to hex, so every run, screenshot and diff is reproducible — a screen that renders differently on every load cannot be diffed or reviewed.

**The client persists only what it owns.** Session, form drafts and onboarding go to `sessionStorage` with `skipHydration`, so a refresh or a pasted URL keeps them without causing a hydration mismatch. Protocol figures are never persisted: a reload showing a stale position as though it were current is the exact failure a cache is meant to prevent. Deep links adopt the matching surface.

**The snapshot refreshes every 30 seconds** while the tab is visible, pausing when hidden and firing immediately on return. A failed background refresh leaves the last good snapshot on screen rather than flashing an error over figures that are still valid.

---

## Conventions

- **Internal packages ship TypeScript source**, compiled in place by `transpilePackages`. No watch-and-rebuild step between editing a component and seeing it.
- **Relative imports carry no `.js` extension** — the workspace resolves with `moduleResolution: "Bundler"`.
- **Numbers go through `@rivora/core/format`.** Currency two decimals, rates two, factors one or two, deltas signed with a direction glyph, addresses truncated 6+4.
- **Colour never carries meaning alone.** Every status and check mark has a glyph (screens.md §13.4).
- **Wide tables scroll inside their own container.** The page never scrolls sideways.

---

## What is real, and what is not yet

The API is the ledger of record. `ChainService` has two implementations and
`CHAIN_MODE` selects between them: `ledger` keeps money movement in
PostgreSQL with deterministic stand-in hashes, `arc` broadcasts through a
Circle Developer-Controlled Wallet — no key material ever touches the
process. Arc mode has been live-fired against the testnet deployment: real
assessment exports, a real draw, real revenue distributed through the router
onchain, with the reconciling indexer matching chain events to ledger rows
and alarming on divergence in either direction. Deployments default to
ledger mode because broadcasting value should be a deliberate choice, never
what happens when a variable is unset.

Every PRD §36 acceptance criterion passes: x402 origination with real
EIP-3009 verification, derived-not-asserted underwriting inputs, the
detection loop that restricts a borrower manufacturing revenue, the
two-operator default quorum, webhooks for all ten §27 events, and the AI
narration that explains a decision it cannot influence.

What stands between this and production is recorded, not implied —
[backlog.md](backlog.md) item 19 is the gate list: an external contract
audit (an internal adversarial review found and fixed a critical exit-queue
bug; nothing substitutes for fresh eyes), settlement through Circle's
production interfaces rather than signature-verified simulation, legal
review — lending is a regulated activity — and the smaller items behind
them. Until that list is worked through, this is a complete testnet
protocol, and it says so on every page.
