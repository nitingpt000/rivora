# Audit readiness

What an auditor needs on day one: what is in scope, what the contracts are
supposed to guarantee, who is trusted with what, what we already found
ourselves, and what we know is wrong and decided to live with.

**These contracts have not been audited.** This document does not substitute
for one. It exists so that the audit spends its time on what we could not
find rather than on what we could.

---

## 1 — Scope

Commit: see `git rev-parse HEAD`. Solidity 0.8.28, Foundry, OpenZeppelin 5.

| Contract | Lines | Holds funds | Notes |
| --- | --- | --- | --- |
| `RivoraCreditVault.sol` | 341 | **Yes** — all LP liquidity | Shares, exit queue, loss socialisation |
| `RivoraCreditManager.sol` | 407 | No (moves vault funds) | Borrower accounts, draw, repay, interest |
| `RivoraRevenueRouter.sol` | 265 | Transiently | Splits settled revenue three ways |
| `RivoraRiskRegistry.sol` | 193 | No | EIP-712 signed assessments |
| `RivoraMath.sol` | 165 | No | Pure arithmetic, shared |
| `RivoraTypes.sol` | 82 | No | Enums, structs, constants |

Out of scope: the API (`apps/api`), the web app, Circle's Gateway and
Developer-Controlled Wallet infrastructure.

**The vault is where the money is.** `RivoraCreditVault` is the only contract
holding a balance at rest, and the exit queue is the only place a claim on
money is recorded in one transaction and settled in another. Both internal
findings below were in that seam, which is where we would concentrate a
review budget.

---

## 2 — Invariants

What must hold after any sequence of calls. Stated so they can be falsified.

**Solvency**

1. `totalAssets() == asset.balanceOf(vault) + totalBorrowed`, always.
2. The sum over queue entries of `funded` never exceeds
   `asset.balanceOf(vault)` — everything promised is present.
3. `fundedUnclaimed == Σ entry.funded` over unclaimed entries.
4. A queue entry never pays out more than `amount`: `paid + funded <= amount`.
5. Shares are only minted in `deposit` and only burned in `withdraw`.

**Credit**

6. `account.principal` only rises in `draw` and only falls in `_applyRepayment`.
7. A draw never exceeds `availableCredit(limit, principal, 0)`.
8. A limit only changes through `syncLimitFromRegistry` (from a signed
   assessment) or `restrict` (to zero). Nothing else may set it.
9. `repay` transfers exactly what it applies — no overpayment is ever held.
10. Interest accrues monotonically and only through `_accrue`.

**Registry**

11. An assessment is accepted only with a live signature from an
    `UNDERWRITER_ROLE` holder, an unexpired `validUntil`, and `nonce` equal to
    the borrower's current nonce.
12. `nonces[borrowerId]` is strictly increasing; no assessment replays.

**Router**

13. `toRepayment + toReserve + toOperating == amount`, exactly, for every input.
14. `toRepayment <= outstandingDebt(borrowerId)` at distribution time.

Invariants 1–4 and 13 have tests. **7, 8, 10, 12 are asserted by unit tests but
not by a stateful invariant campaign** — that is the most valuable thing an
auditor could add on top of this suite.

---

## 3 — Trust model

| Role | Holder today | Can do | Cannot do |
| --- | --- | --- | --- |
| `DEFAULT_ADMIN_ROLE` | Protocol admin EOA | Grant/revoke every role, set tier rates | Move funds directly |
| `RISK_ROLE` (vault) | Protocol admin | Record losses, pause | Withdraw to itself |
| `RISK_ROLE` (manager) | Protocol admin | Register borrowers, restrict, set status | Set a limit to a non-zero value |
| `CREDIT_MANAGER_ROLE` | Manager contract | `fundDraw`, `receiveRepayment` | Held by no EOA |
| `UNDERWRITER_ROLE` | Circle wallet (API signer) | Sign assessments | Submit without a signature; move funds |
| `ROUTER_ROLE` | Each borrower's router | Book routed repayments for *its own* borrower | Credit another borrower's debt |
| Borrower `owner` | Borrower's wallet | `draw` (to the registered operating wallet), `repay` | Redirect a draw |

**Explicitly trusted.** The admin is trusted not to grant `RISK_ROLE` to a
hostile party and not to set a punitive tier rate. On testnet the admin is a
single EOA; anything real must be a multisig, and that is a deployment
requirement, not a code change.

**Explicitly not trusted.** The borrower, the router caller, the assessment
submitter, and any queue participant. `distributeRevenue` and
`submitAssessment` are permissionless on purpose — authority is the signature
and the balance, not the sender.

**Deliberate centralisation.** `recordLoss` is a `RISK_ROLE` action with no
onchain proof of the default. The offchain quorum (two distinct operators,
`apps/api/src/risk`) is what constrains it, and an auditor should treat the
onchain control as: *the admin can socialise a loss at will.*

---

## 4 — Internal findings

Found by an adversarial review of this codebase, before any external audit.
Tests are in `test/Adversarial.t.sol` and fail against the unfixed code.

### RIV-01 — Critical — A partially claimed exit could be paid twice

`claimQueued` zeroed `entry.funded` and left `entry.amount` naming the whole
original claim. To the next funding pass the entry looked untouched, so it was
funded again up to `amount` and could be claimed a second time.

*Impact.* A liquidity provider whose exit was partially funded, who claimed,
and who waited for the next repayment, withdrew more than they were owed —
out of the liquidity belonging to everyone else. No special access required:
partial funding is the ordinary path for any exit above the buffer floor.

*Proof.* `test_partialClaimCannotBePaidTwice` — against the unfixed contract a
50,000 USDC queued exit paid out 60,000.

*Fix.* `QueueEntry.paid` records what has been settled; funding computes
`outstanding = amount - paid - funded`, and an entry closes when
`paid >= amount`.

### RIV-02 — Medium — Funding counted the same dollars twice

`_fundQueue` read `availableLiquidity()`, which includes money already
allocated to earlier entries and not yet withdrawn. Two entries could
therefore be promised the same balance; the second claimant would find it
gone.

*Impact.* Not a theft — no one receives more than they are owed — but the
vault promises what it cannot pay, and the failure lands on whoever claims
second. Unreachable in the current tests, which is why it is medium rather
than high: it needs a specific interleaving of partial funding and delayed
claims.

*Fix.* `fundedUnclaimed` tracks outstanding allocations and is excluded from
what a funding pass considers free.

### RIV-03 — Informational — Withdrawal rounding favours the caller

`convertToShares` rounds down, so a withdrawal burns marginally fewer shares
than the assets released are worth. The gap is sub-unit at 6 decimals and
cannot be farmed profitably against gas, but it is a leak in the LP's
direction rather than the vault's, which is the wrong direction of the two.

### RIV-04 — Informational — Silent clamps hide accounting drift

`receiveRepayment` and `recordLoss` clamp `totalBorrowed` at zero rather than
reverting when the subtraction would underflow. That is deliberate — a stuck
vault is worse than a wrong total — but it means a real accounting divergence
would be absorbed silently instead of surfacing. The offchain reconciler
(`apps/api/src/chain/indexer.service.ts`) is what is expected to notice.

---

## 5 — Known and accepted

- **Testnet deployment carries RIV-01 and RIV-02.** The instances in
  `deployments/arc-testnet.json` were deployed before the fix. Exposure is
  nil in practice — `queueLength() == 0`, so no exit has ever queued — but the
  fixed code is not live. Redeploying requires the admin wallet to re-grant
  roles and re-register borrowers; until then the live vault must be treated
  as vulnerable if anyone queues an exit.
- **No stateful invariant campaign.** Unit and differential tests only.
- **The differential tests compare against `@rivora/core`**, the TypeScript
  the product uses. They prove the two agree, not that either is right.
- **`_fundQueue` processes at most 16 entries per repayment**, bounding gas.
  A long queue drains over several repayments; it cannot be front-run out of
  order because the queue is strictly FIFO.
- **Timestamp dependence** in interest accrual and assessment expiry is
  intentional and documented at both call sites. Validity is measured in
  hours; a validator nudging seconds gains nothing.
- **USDC on Arc is 6-decimal through the ERC-20 interface and 18-decimal as
  the native gas token.** Nothing here touches the native balance. An auditor
  should confirm no path assumes 18.
- **Upgradeability: none.** Fixing a bug means redeploying and migrating,
  which is why the exit queue's correctness matters more than usual.

---

## 6 — Reproducing

```bash
cd contracts
git submodule update --init --depth 1
forge test               # 51 tests: unit, fuzz, differential, adversarial
forge test --match-contract Adversarial -vvv
forge coverage
```

The differential suite needs the TypeScript side too:

```bash
pnpm --filter @rivora/core test
```
