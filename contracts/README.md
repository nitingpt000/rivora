# @rivora/contracts

## Setup

`forge-std` is a git submodule; OpenZeppelin comes from pnpm and is linked into
`lib/` so Foundry can resolve it without escaping the project root.

```bash
git submodule update --init --depth 1
pnpm install
```


The protocol contracts for Arc. Solidity 0.8.28, Foundry.

```bash
pnpm --filter @rivora/contracts test        # 48 tests
pnpm --filter @rivora/contracts coverage
pnpm --filter @rivora/contracts deploy:arc
```

Requires [Foundry](https://getfoundry.sh). Without it the tasks skip with a warning rather than failing the JavaScript workspace — but a skipped suite is not a pass, and CI must install it.

---

## The four contracts

| Contract | Holds funds | Responsibility |
| --- | :---: | --- |
| `RivoraCreditVault` | ✅ | LP deposits, share accounting, funding draws, the FIFO exit queue |
| `RivoraCreditManager` | — | Borrower accounts, limits, interest, the status machine |
| `RivoraRevenueRouter` | ✅ | Splits one borrower's settled revenue three ways |
| `RivoraRiskRegistry` | — | Signed underwriting assessments |

The manager holds nothing. A bug there can mis-authorise a draw against a limit; it cannot drain the vault.

---

## Why the router is pull-based

The PRD assumed the router could be registered as the nanopayment settlement destination, so a settling batch would call it and the waterfall would run atomically on receipt. **That is not how Circle Nanopayments settles.**

Proceeds land in the seller's Circle **Gateway balance**, and reach Arc only when a burn intent withdraws them to a recipient. That withdrawal is a plain ERC-20 transfer — and an ERC-20 transfer does not execute code at the recipient.

So `distributeRevenue()` cannot be a callback. It is permissionless and operates on whatever balance the router is holding, callable by the borrower, a keeper, or anyone. Permissioning it would mean revenue sitting undistributed because one caller was down, which is exactly the failure the structural claim is meant to rule out. Calling it is never harmful: the split is fixed by configuration the borrower cannot change.

**What this does not fix.** If the borrower controls the Gateway balance, they control whether a withdrawal happens at all. That is PRD §11.2 Model C — behavioural, 25% advance rate — not Model A. Restoring enforceability needs Rivora to hold the withdrawal right, which is a Circle account configuration question no contract can assert.

---

## The differential tests

`test/Differential.t.sol` is the reason to trust the arithmetic.

The borrower sees a preview computed by `@rivora/core` before they sign; the chain then computes the real thing. If those disagree, the number the borrower consented to is not the number that executed. Neither side's unit tests can catch that alone.

`script/generate-fixtures.ts` runs the *actual* TypeScript and writes its outputs to `test/fixtures/core.json`; the Solidity asserts against them. Hand-written expectations would encode what someone believed the TypeScript did.

It has already earned its place — it caught three real divergences:

1. **`amount` meant different things.** `@rivora/core` returns the *requested* amount with `excess` carrying the overpayment; the Solidity was returning the *applied* amount. Downstream, `repay()` was pulling the full requested amount and applying only part, silently keeping the difference.
2. **The router sent funds to the wrong address** — transferring to the manager while booking the repayment against the vault, stranding USDC in a contract whose accounting said it was elsewhere.
3. **The router could over-repay.** The repayment share is a percentage of revenue, not of debt, so a nearly-cleared borrower would have had more routed than they owed. It now caps at the outstanding balance and sends the remainder to operating — which is also what PRD §12.2 specifies.

### The precision boundary

`@rivora/core` rounds to **two decimals** — it is the library behind what a borrower is *shown*, and money is displayed in cents. The chain settles at USDC's **six**. They cannot agree below a cent, so the fixtures use cent-exact inputs and sub-cent behaviour is covered separately in `test/RivoraMath.t.sol`.

---

## USDC on Arc

Two scales, and they are not interchangeable:

- **18 decimals** as the native gas token — what a wallet renders as a balance.
- **6 decimals** through the ERC-20 interface at `0x3600000000000000000000000000000000000000` — what these contracts hold and what every protocol figure means.

`MockUSDC` in the tests is 6 decimals for that reason. Testing at an 18-decimal default would hide rounding errors that are a whole cent at the real scale.

---

## Security posture

Per PRD §31.1: reentrancy guards, checks-effects-interactions, role-based access, pausable, `SafeERC20`, assessment nonces, signature expiry, EIP-712 domain separation.

Specific decisions worth knowing:

- **Dead shares on first deposit.** `DEAD_SHARES` are minted unredeemable, closing the inflation attack where a tiny first deposit plus a donation rounds later depositors to zero shares.
- **Not ERC-4626.** The standard promises `withdraw` returns what was asked for. This vault cannot: liquidity below the buffer floor is committed to the book and the remainder queues. Implementing the interface and violating its central expectation would be worse than not implementing it.
- **Queue funding is bounded** to 16 entries per repayment, so a long queue cannot make repayment run out of gas.
- **Liquidity owed to the queue is not lendable** — a draw cannot jump the exit queue.
- **The borrower cannot change their own repayment share.** `configure()` is `CONFIG_ROLE`, held by the manager.

### Not done

**No audit.** These hold liquidity-provider funds; nothing here substitutes for one.

Also outstanding: no upgradeability (deployment is immutable, which is a deliberate MVP choice and a real constraint), no governance timelock on `setTierRate`, no per-borrower exposure cap enforced onchain (it is advisory on the ladder, per PRD §31.5), and branch coverage sits at ~43% — the revert paths are thinner than the happy paths.

---

## Deploying

```bash
export PROTOCOL_ADMIN=0x...
export UNDERWRITER_ADDRESS=0x...
pnpm --filter @rivora/contracts deploy:arc
```

Fund the deployer at [faucet.circle.com](https://faucet.circle.com). Record the addresses in `deployments/arc-testnet.json` and in `apps/api/.env`.

Circle's Smart Contract Platform can deploy the same bytecode through its API, which keeps the deployer key inside Circle rather than in an environment variable. `script/Deploy.s.sol` is the local equivalent and produces the artefacts SCP uploads.

The Revenue Router is not deployed here — there is one per borrower, created at registration.
