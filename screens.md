# Rivora — Screen Specification

**Product:** Rivora
**Companion to:** [PRD.md](PRD.md) v1.1
**Version:** 1.0
**Purpose:** Every screen in the product, as an ASCII wireframe, with the data points each one reads and where those data points come from.

---

# 1. How to read this document

## 1.1 Screen entry format

Each screen has:

1. **Header** — screen ID, route, primary user, the PRD section it satisfies.
2. **Wireframe** — ASCII, 78 columns, populated with the canonical dataset in section 3 so that every screen tells one coherent story.
3. **Data points** — every value on screen, its source, its refresh cadence, and its disclosure tier.
4. **Actions** — what the user can do and what gates each action.
5. **States** — empty, loading, error and restricted variants.

## 1.2 Disclosure tiers

Taken directly from PRD §21.2. Every data point on every screen carries one.

```text
PUB    Public. Safe for unauthenticated view and the public API.
BOR    Borrower-private. Visible only to the borrower who owns it.
LP     Liquidity-provider. Portfolio-level only, never per-borrower.
OPS    Risk operator. Exact values, access-logged.
CHAIN  Written onchain and therefore permanently public.
NEVER  Must not appear in any interface. Listed where a designer
       might reasonably expect it.
```

## 1.3 Refresh cadence

```text
RT      Real time — websocket or event subscription
EVT     On contract event
10s     Polled, 10-second target (PRD §33 performance)
ASSESS  Changes only when a new assessment lands
STATIC  Set at onboarding
```

## 1.4 Wireframe legend

```text
[ Button ]        Primary action
( Button )        Secondary action
< Button >        Destructive or restricted action
[▓▓▓▓░░░░]        Progress or utilization bar
▲ ▼               Delta indicator, up / down
●                 Status dot
✓ ✕ ⚠ ⏱           Pass / fail / warning / pending
0x7f3a…c1d2       Truncated address, click to copy, links to explorer
⧉                 Transaction hash chip, links to Arc explorer
▸                 Expandable row
```

---

# 2. Screen inventory

| ID | Screen | User | Route | PRD |
| --- | --- | --- | --- | --- |
| **Public** | | | | |
| S-01 | Landing | Anyone | `/` | §29.1 |
| S-02 | Protocol activity | Anyone | `/activity` | §29.1 |
| S-03 | Public reputation page | Anyone | `/reputation/:id` | §19.6 |
| S-04 | Default registry | Anyone | `/defaults` | §19.4 |
| **Borrower onboarding** | | | | |
| S-10 | Onboarding — connect and profile | Borrower | `/onboard` | §22.1 |
| S-11 | Onboarding — endpoint and binding | Borrower | `/onboard/endpoint` | §11.4 |
| S-12 | Onboarding — custody and router | Borrower | `/onboard/custody` | §11.2 |
| S-13 | Onboarding — costs, wallet, terms | Borrower | `/onboard/terms` | §13.10 |
| S-14 | Observation state | Borrower | `/dashboard` | §16.2 |
| **Borrower core** | | | | |
| S-20 | Borrower dashboard | Borrower | `/dashboard` | §29.2 |
| S-21 | Revenue analytics | Borrower | `/revenue` | §29.3 |
| S-22 | Excluded revenue detail | Borrower | `/revenue/excluded` | §22.2 |
| S-23 | Customer concentration | Borrower | `/revenue/customers` | §13.7 |
| S-24 | Credit | Borrower | `/credit` | §29.4 |
| S-25 | Draw request | Borrower | `/credit/draw` | §22.4 |
| S-26 | Manual repayment | Borrower | `/credit/repay` | §22.5 |
| S-27 | Assessment explanation | Borrower | `/credit/assessment/:id` | §14.5 |
| S-28 | Credit limit history | Borrower | `/credit/history` | §22.3 |
| S-29 | Custody and endpoint binding | Borrower | `/custody` | §11.4 |
| S-30 | Agent spending policy | Borrower | `/policy` | §22.8 |
| S-31 | Reserve and security bond | Borrower | `/reserve` | §10.6 |
| S-32 | Watch / Restricted states | Borrower | `/dashboard` | §17.4 |
| S-33 | Recovery and cure | Borrower | `/recovery` | §19.5 |
| S-34 | Account closure | Borrower | `/settings/close` | §16.7 |
| **Liquidity provider** | | | | |
| S-40 | LP dashboard | LP | `/vault` | §29.5 |
| S-41 | Deposit | LP | `/vault/deposit` | §22.6 |
| S-42 | Withdraw and queue | LP | `/vault/withdraw` | §23.4 |
| S-43 | Portfolio composition | LP | `/vault/portfolio` | §21.5 |
| S-44 | Performance and losses | LP | `/vault/performance` | §23.6 |
| **Risk operator** | | | | |
| S-50 | Risk console overview | Ops | `/risk` | §29.6 |
| S-51 | Watchlist | Ops | `/risk/watch` | §22.7 |
| S-52 | Borrower risk detail | Ops | `/risk/borrower/:id` | §22.7 |
| S-53 | Anomaly detail | Ops | `/risk/anomaly/:id` | §20.1 |
| S-54 | Exposure and concentration | Ops | `/risk/exposure` | §23.8 |
| S-55 | Parameters and emergency | Ops | `/risk/params` | §31.5 |
| S-56 | Default declaration | Ops | `/risk/default/:id` | §19.8 |
| **Partner** | | | | |
| S-60 | Partner console | Partner | `/partner` | §28.2 |
| S-61 | Score API sandbox | Partner | `/partner/sandbox` | §28.3 |
| **System** | | | | |
| S-70 | Notifications | All | `/notifications` | §22.7 |
| S-71 | Demo control panel | Demo | `/demo` | §35.2 |

---

# 3. Canonical dataset

Every wireframe in this document is populated from this single dataset, taken at **simulated day 60** — after the second assessment in PRD §35.3 and before the manipulation event. Screens showing the manipulation event are marked and use the post-detection values.

## 3.1 Borrower

```text
borrowerId              0x9c4e…a7f1
Service name            QuoteStream Market Data API
Category                Data lookup and static datasets
Endpoint                https://api.quotestream.dev/v1
Revenue Router          0x7f3a…c1d2
Operating wallet        0x2b18…9e04
Owner wallet            0x5d92…3ba6
Custody model           A — router is settlement destination
Registered              2026-06-03
Status                  ACTIVE
```

## 3.2 Credit position

```text
Risk score              78          Tier  Strong
Approved credit limit   2,530.00 USDC
Outstanding principal   2,000.00 USDC
Accrued interest            8.42 USDC
Available credit          530.00 USDC
Borrower rate              10.71%   = r(U) 7.71% + Strong premium 3.00%
Repayment share               20%
Reserve share                  2%
Reserve balance           248.60 / 253.00 target
Interest coverage          104.2   (≥ 3.0 required)
Projected payback         22 days
```

## 3.3 Revenue, trailing 30 days

```text
Authorizations issued    351,000
Settled successfully     337,500   96.2%
Failed / unfulfilled      13,500
Refunded                     126   0.9%

Gross revenue          14,040.00 USDC
Excluded revenue          540.00 USDC
Normalized eligible    13,500.00 USDC
Mean daily revenue        450.00 USDC
Median daily revenue      441.00 USDC
Growth vs prior 30d          +35%

Unique eligible payers       386
Repeat payers                168
Largest payer share          14%
HHI                         0.14
Coverage ratio              0.98
```

## 3.4 Factors, assessment 2

```text
S  Service reliability     0.95    weight 0.30    penalty 1.50 pts
C  Customer concentration  0.86    weight 0.25    penalty 3.50 pts
V  Revenue volatility      0.90    weight 0.15    penalty 1.50 pts
D  Revenue diversity       0.95    weight 0.15    penalty 0.75 pts
M  Operating capacity      0.88    weight 0.15    penalty 1.80 pts
                                   ────────────────────────────────
                                   Q = 1 − 0.0905 = 0.9095
G  Revenue growth          1.10
```

## 3.5 Vault

```text
Total vault assets      25,000.00 USDC
Available liquidity     16,530.00 USDC
Outstanding principal    8,470.00 USDC
Utilization                 33.88%
Base borrow rate             7.71%
Blended borrower rate       12.10%
Protocol reserve            412.60 USDC
First-loss tranche        2,500.00 USDC   10.0% coverage
LP organic APY               3.08%
LP bootstrap subsidy         2.92%
LP displayed APY             6.00%
Active borrowers                 7
Withdrawal queue             0.00 USDC
Realized losses              0.00 USDC
Liquidity buffer           15.00% floor, currently 66.1%
```

## 3.6 Liquidity provider position

```text
LP address              0x8e11…4c73
Supplied                 5,000.00 USDC
Shares held              4,962.31 RIV-USDC
Share price                1.007597
Current value            5,000.00 USDC   (deposited day 58)
Interest earned              0.00 USDC
Queue position                none
```

---

# 4. Navigation map

```text
                              ┌──────────────┐
                              │  S-01  Landing│
                              └───────┬───────┘
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
     ┌─────────────────┐   ┌────────────────────┐   ┌──────────────────┐
     │ Register service│   │    Supply USDC     │   │  S-02  Activity  │
     └────────┬────────┘   └─────────┬──────────┘   └────────┬─────────┘
              ▼                      ▼                       ▼
     ┌─────────────────┐   ┌────────────────────┐   ┌──────────────────┐
     │ S-10 → S-13     │   │  S-40  LP dash     │   │ S-03 Reputation  │
     │ Onboarding      │   │                    │   │ S-04 Defaults    │
     └────────┬────────┘   └─────────┬──────────┘   └──────────────────┘
              ▼                      │
     ┌─────────────────┐             ├──► S-41 Deposit
     │ S-14 Observation│             ├──► S-42 Withdraw + queue
     └────────┬────────┘             ├──► S-43 Portfolio
              ▼                      └──► S-44 Performance
     ┌─────────────────┐
     │ S-20  Dashboard │
     └────────┬────────┘
              │
      ┌───────┼───────┬───────────┬──────────┬──────────┐
      ▼       ▼       ▼           ▼          ▼          ▼
   S-21    S-24    S-29        S-30       S-31       S-32/33
  Revenue  Credit  Custody     Policy     Reserve    Watch /
      │       │                                      Recovery
      ├─S-22  ├─S-25 Draw
      ├─S-23  ├─S-26 Repay
      │       ├─S-27 Assessment
      │       └─S-28 History
      │
      └───────────────────────────────────────────────────────

   Operator surface (separate auth):
     S-50 Overview ─┬─ S-51 Watchlist ── S-52 Borrower detail
                    ├─ S-53 Anomaly detail
                    ├─ S-54 Exposure
                    ├─ S-55 Parameters
                    └─ S-56 Default declaration

   Partner surface (API key auth):
     S-60 Console ──── S-61 Sandbox
```

---

# 5. Shared components

## 5.1 Application chrome — borrower

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA    Dashboard  Revenue  Credit  Custody  Policy  Reserve      ⌄ 0x5d92│
│                                                          ● Strong · Score 78 │
├──────────────────────────────────────────────────────────────────────────────┤
```

```text
Status pill colours
  ● OBSERVATION   grey     ● ACTIVE       green
  ● ELIGIBLE      blue     ● WATCH        amber
  ● RESTRICTED    orange   ● DELINQUENT   red
  ● DEFAULTED     red      ● REPAID       green outline
```

## 5.2 Alert banner

Rendered above page content whenever the borrower is not in ACTIVE or ELIGIBLE state, or when any risk trigger is live.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠  WATCH — Customer concentration rose above 40%                             │
│    New draws are still permitted at a reduced limit. Concentration must fall │
│    below 40% for two consecutive assessments to return to ACTIVE.            │
│    Detected 2026-08-01 14:22 UTC                          ( What changed? )  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 5.3 Transaction chip

Every financial action renders one. Required by PRD §36 acceptance criterion 15.

```text
⧉ 0x4a71…9f30   Arc · block 8,204,113 · finalized 0.6s   ( View on explorer )
```

## 5.4 Value cell with provenance

Any underwriting-relevant number is hoverable and shows where it came from. This is the interface expression of PRD §33 explainability.

```text
  Normalized eligible revenue
  13,500.00 USDC  ⓘ
                  └─ Time-weighted, λ=0.97, clamped at median × 1.5
                     Excludes 540.00 USDC — see breakdown
                     Window 2026-07-03 → 2026-08-01
                     Seasoned to 2026-07-30 (3-day delay)
```

---
# 6. Public screens

## 6.1 S-01 — Landing

**Route** `/` · **User** anyone · **PRD** §29.1

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA                          Docs   Activity   Reputation      [ Launch ]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                      Credit for autonomous commerce                          │
│                                                                              │
│        Rivora transforms verifiable API and agent revenue into               │
│        programmable USDC working capital.                                    │
│                                                                              │
│        [ Register a service ]   [ Supply USDC ]   ( View protocol activity ) │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  LIVE PROTOCOL STATE                                        Arc Testnet ● up │
│                                                                              │
│   Total value locked      Outstanding credit     Utilization                 │
│   25,000.00 USDC          8,470.00 USDC          33.9%  [▓▓▓░░░░░░░]         │
│                                                                              │
│   Active borrowers        Revenue routed 30d     Principal repaid            │
│   7                       41,280.00 USDC         6,190.00 USDC               │
│                                                                              │
│   Realized losses         Default rate           Repaid from revenue         │
│   0.00 USDC               0.0%                   100.0%                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  HOW IT WORKS                                                                │
│                                                                              │
│   1  Machine provides a service      →   Customer pays through x402          │
│   2  Revenue becomes verifiable      →   Rivora scores creditworthiness      │
│   3  Credit Vault provides USDC      →   Agent spends within policy          │
│   4  Future revenue repays the loan  →   Repayment improves credit           │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⚠  Arc Testnet. Test assets only, no real value. Credit scores are          │
│     experimental. Displayed yields include a protocol subsidy and are not    │
│     guaranteed. Rivora is not a licensed lender in any jurisdiction.         │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Total value locked | `CreditVault.totalAssets()` | EVT | PUB |
| Outstanding credit | `CreditVault.totalBorrowed()` | EVT | PUB |
| Utilization | Derived, PRD §15.1 | EVT | PUB |
| Active borrowers | `CreditManager` borrower count, status ∈ {ACTIVE, WATCH} | EVT | PUB |
| Revenue routed 30d | Sum of router inflow events | 10s | PUB |
| Principal repaid | Sum of `receiveRepayment.principal` | EVT | PUB |
| Realized losses | Sum of `recordLoss` | EVT | PUB |
| Default rate | Defaulted principal / originated principal | EVT | PUB |
| Repaid from revenue | Router-sourced repayment / total repayment | EVT | PUB |
| Network status | Arc RPC health probe | 10s | PUB |

**Actions** — Register a service → S-10. Supply USDC → S-40. View activity → S-02.

**States** — If the vault is paused, the hero CTAs are replaced by a pause notice with the reason and the pausing operator quorum.

---

## 6.2 S-02 — Protocol activity

**Route** `/activity` · **User** anyone · **PRD** §29.1, §36 criterion 15

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Protocol activity                                    Arc Testnet   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Filter  [ All ▾ ]  [ Draws ]  [ Repayments ]  [ Assessments ]  [ Risk ]     │
├──────────────────────────────────────────────────────────────────────────────┤
│  TIME      EVENT                 BORROWER      AMOUNT        TX              │
│  ─────────────────────────────────────────────────────────────────────────── │
│  14:31:02  repayment.completed   0x9c4e…a7f1      90.00 USDC  ⧉ 0x4a71…9f30  │
│            interest 0.24 · principal 89.76                                   │
│  14:30:58  revenue.settled       0x9c4e…a7f1     450.00 USDC  ⧉ 0x4a71…9f30  │
│  13:04:11  credit.draw           0x1f88…20ce     600.00 USDC  ⧉ 0xbb02…7741  │
│  12:47:33  credit.limit.updated  0x9c4e…a7f1   2,530.00 USDC  ⧉ 0x39d5…8ca0  │
│            score 68 → 78 · Standard → Strong · capped by growth cap          │
│  12:47:30  risk.assessment.done  0x9c4e…a7f1              —   ⧉ 0x39d5…8ca0  │
│  11:15:09  vault.deposit         0x8e11…4c73   5,000.00 USDC  ⧉ 0x77ae…1b62  │
│  09:22:44  borrower.watchlisted  0x4c30…f18b              —   ⧉ 0x0d31…44a9  │
│            reason: coverage ratio 0.71                                       │
│  08:00:00  vault.utilization     —                    33.88%  ⧉ 0x91cc…5d17  │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                            ( Load more )     │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Event type | Contract event topic | RT | CHAIN |
| Borrower ID | Event field, pseudonymous | RT | CHAIN |
| Amount | Event field | RT | CHAIN |
| Transaction hash | Event receipt | RT | CHAIN |
| Interest / principal split | `receiveRepayment` fields | RT | CHAIN |
| Score and tier transition | `RiskRegistry` assessment event | RT | CHAIN |
| Binding constraint label | Assessment record, non-sensitive field | RT | PUB |
| Watchlist reason | Enumerated reason code, not raw values | RT | PUB |

**Never displayed here** — payer addresses, revenue amounts per customer, endpoint URLs, borrower legal identity.

---

## 6.3 S-03 — Public reputation page

**Route** `/reputation/:borrowerId` · **User** anyone · **PRD** §19.6

This screen is the human-readable rendering of the signed attestation. It is what a marketplace or a counterparty checks before extending its own credit.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Machine credit reputation                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   0x9c4e…a7f1                                            ● STRONG            │
│   Endpoint hash  0x3b7d…e922                             Score  78 / 100     │
│                                                                              │
│   ┌────────────────────────┬────────────────────────┬──────────────────────┐ │
│   │ Months observed        │ Repayment cycles       │ On-time ratio        │ │
│   │ 2                      │ 1 complete             │ 100%                 │ │
│   ├────────────────────────┼────────────────────────┼──────────────────────┤ │
│   │ Principal repaid       │ Defaults recorded      │ Custody model        │ │
│   │ 1,180.00 USDC          │ 0                      │ A — structural       │ │
│   └────────────────────────┴────────────────────────┴──────────────────────┘ │
│                                                                              │
│   SIGNAL BANDS                                                               │
│   Service reliability      HIGH        ████████░░                            │
│   Revenue consistency      HIGH        ████████░░                            │
│   Customer concentration   MODERATE    ██████░░░░                            │
│   Customer diversity       HIGH        ████████░░                            │
│   Revenue custody          STRUCTURAL  ██████████                            │
│                                                                              │
│   Attested 2026-08-02 14:00 UTC · model riv-uw-2.1 · valid 24h               │
│   Signature 0x8f21…03bd                          ( Verify )  ( Copy JSON )   │
│                                                                              │
│   Not disclosed: revenue figures, payer identities, per-customer split,      │
│   endpoint URL, operator identity.                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Score, tier | `RiskRegistry` latest assessment | ASSESS | PUB |
| Months observed | Days since first eligible revenue | ASSESS | PUB |
| Repayment cycles, on-time ratio | Repayment history aggregate | EVT | PUB |
| Principal repaid | Cumulative `receiveRepayment.principal` | EVT | PUB |
| Defaults recorded | Default registry | EVT | CHAIN |
| Custody model | Binding record | ASSESS | PUB |
| Signal bands | Bucketed factors, PRD §21.3 | ASSESS | PUB |
| Signature, model version | Attestation payload | ASSESS | PUB |
| Exact factor values | — | — | **NEVER** |
| Absolute revenue | — | — | **NEVER** |

**Actions** — Verify recomputes the signature against the published signer key, client-side. Copy JSON yields the exact payload in PRD §19.6.

---

## 6.4 S-04 — Default registry

**Route** `/defaults` · **User** anyone · **PRD** §19.4

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Default registry                                                   │
│  Records are permanent. A default may be cured but is never removed.         │
├──────────────────────────────────────────────────────────────────────────────┤
│  Filter  [ All ▾ ]   [ Uncured ]   [ Cured ]        Search 0x…    [ Query ]  │
├──────────────────────────────────────────────────────────────────────────────┤
│  BORROWER      DEFAULTED    PRINCIPAL    RECOVERED   STATUS      TRIGGER     │
│  ─────────────────────────────────────────────────────────────────────────── │
│  0x4c30…f18b   2026-07-14   1,850.00     1,850.00    ✓ CURED     coverage    │
│                cured 2026-07-29                       2026-07-29  ratio 0.31 │
│  ▸ evidence 0x6d20…be15 · declared automatically · 15 days to cure           │
│                                                                              │
│  0xaa71…0d3c   2026-06-28   4,200.00       960.00    ⚠ UNCURED   router      │
│                35 days elapsed                                     disabled  │
│  ▸ evidence 0x1c88…44f7 · declared automatically · recovery 22.9%            │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Registry totals   2 records · 6,050.00 principal · 2,810.00 recovered       │
│                    Recovery rate 46.4% · Cure rate 50.0%                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Borrower ID, defaulted at, cured at | `DefaultRecord` | EVT | CHAIN |
| Principal at default, recovered | `DefaultRecord` | EVT | CHAIN |
| Trigger reason | Enumerated code from the trigger that fired | EVT | CHAIN |
| Evidence hash | `DefaultRecord.evidenceHash` | EVT | CHAIN |
| Declaration path | Automatic vs. operator quorum | EVT | CHAIN |
| Recovery rate, cure rate | Derived across all records | EVT | PUB |

**Design note** — a cured record stays visible with its cure date, in the same way a settled delinquency stays on a conventional credit file. There is no interface path to delete a record, deliberately: the registry's value to third parties depends on it being non-negotiable.

---

# 7. Borrower onboarding

Target: complete in under ten minutes (PRD §22.1 acceptance criteria).

```text
  ①  Connect & profile  ─►  ②  Endpoint & binding  ─►  ③  Custody & router
                                                              │
                            ⑤  Observation  ◄─  ④  Costs, wallet, terms
```

## 7.1 S-10 — Connect and profile

**Route** `/onboard` · **PRD** §22.1

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Register a service                              Step 1 of 4  ▓▓░░░ │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   WALLET                                                                     │
│   ● Connected   0x5d92…3ba6                             ( Change wallet )    │
│     Circle Wallet · Arc Testnet · 42.10 USDC                                 │
│                                                                              │
│   SERVICE PROFILE                                                            │
│   Service name        [ QuoteStream Market Data API                       ]  │
│   Service category    [ Data lookup and static datasets                 ▾ ]  │
│                       └─ Sets the cost band used by the operating-capacity   │
│                          factor. Changing it later triggers reassessment.    │
│   Short description   [ Real-time and historical equity quote feed         ] │
│                                                                              │
│   OPERATOR                                                                   │
│   ( ) Autonomous agent, no legal operator                                    │
│   (•) Named legal operator                                                   │
│       Entity name     [ QuoteStream Labs Ltd                              ]  │
│       Jurisdiction    [ Singapore                                       ▾ ]  │
│       KYB status      ⏱ Pending — required for cohort 1 borrowers            │
│                                                                              │
│                                                    ( Back )   [ Continue ]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Wallet address, provider, balance | Wallet connector, Arc RPC | RT | BOR |
| Service name, category, description | User input | STATIC | BOR |
| Cost band preview | Protocol cost-band table, PRD §13.10 | STATIC | PUB |
| Operator type | User input | STATIC | OPS |
| Entity name, jurisdiction | User input | STATIC | OPS |
| KYB status | KYB provider webhook | EVT | OPS |

**Gates** — Cannot continue without a connected wallet and a selected category. Named-operator path requires KYB submission before the limit can exceed the new-borrower cap.

---

## 7.2 S-11 — Endpoint and binding verification

**Route** `/onboard/endpoint` · **PRD** §11.4

This is the most important onboarding step and it should feel like it. The user watches the protocol verify their endpoint live.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Register a service                              Step 2 of 4  ▓▓▓▓░ │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   REVENUE ENDPOINT                                                           │
│   Endpoint URL    [ https://api.quotestream.dev/v1                        ]  │
│   Payment method  [ x402 via Circle Nanopayments                        ▾ ]  │
│                                                                              │
│   PROVE YOU CONTROL THIS ENDPOINT                                            │
│   Serve this nonce at the well-known path, or sign it with your endpoint's   │
│   advertised payment key.                                                    │
│                                                                              │
│     GET https://api.quotestream.dev/.well-known/rivora-challenge             │
│     nonce: rv_9f4c2a71e08b3d55                              ( Copy )         │
│                                                                              │
│                                                       [ Verify endpoint ]    │
│                                                                              │
│   VERIFICATION LOG                                                           │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │ 14:02:11  Resolving api.quotestream.dev                          ✓   │   │
│   │ 14:02:11  TLS certificate valid, issued 2026-05-18                ✓   │  │
│   │ 14:02:12  GET /.well-known/rivora-challenge                       ✓   │  │
│   │           nonce matched                                               │  │
│   │ 14:02:12  GET /v1/quote  (unpaid)                                 ✓   │  │
│   │           → 402 Payment Required                                      │  │
│   │           scheme     x402/nanopayment                                 │  │
│   │           asset      USDC · Arc                                       │  │
│   │           amount     0.04                                             │  │
│   │           payTo      0x0000…0000  ⚠ not yet bound                    │   │
│   │ 14:02:13  Endpoint ownership verified                             ✓   │  │
│   │           Router binding pending — continue to step 3                 │  │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                                                    ( Back )   [ Continue ]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Endpoint URL | User input | STATIC | OPS (hashed onchain) |
| Payment method | User input | STATIC | BOR |
| Challenge nonce | Rivora, single-use | RT | BOR |
| DNS / TLS result | Rivora probe | RT | BOR |
| Well-known nonce match | Rivora probe | RT | BOR |
| Advertised `payTo` | Parsed from the live 402 challenge | RT | BOR |
| Advertised price and asset | Parsed from the live 402 challenge | RT | BOR |
| Binding hash | `keccak256(endpointURL, router, owner)` | EVT | CHAIN |

**Errors** — nonce mismatch, endpoint unreachable, endpoint does not return 402, 402 lacks a parseable `payTo`, TLS failure. Each renders inline in the log with the raw response for debugging, and blocks continuation.

---

## 7.3 S-12 — Custody model and router

**Route** `/onboard/custody` · **PRD** §11.2, §11.3

The screen where the borrower learns that custody choice sets their advance rate.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Register a service                              Step 3 of 4  ▓▓▓▓▓ │
├──────────────────────────────────────────────────────────────────────────────┤
│   How will your revenue reach Rivora? This choice sets your maximum          │
│   advance rate, because it determines whether repayment is structural.       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ (•) MODEL A — Router is the settlement destination        RECOMMENDED  │  │
│  │     Settled batches land directly in your Revenue Router, which        │  │
│  │     splits them atomically. Diversion requires changing a registered   │  │
│  │     destination, which Rivora observes.                                │  │
│  │     Advance rate  100% of tier base       Repayment  structural        │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ ( ) MODEL B — Policy-constrained Agent Wallet                          │  │
│  │     Settlement lands in a Circle Agent Wallet whose policy pays the    │  │
│  │     router first. Rivora holds a policy-change veto.                   │  │
│  │     Advance rate   50% of tier base       Repayment  policy-enforced   │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ ( ) MODEL C — Post-settlement sweep                                    │  │
│  │     You sweep a defined share to the router on a schedule. Rivora can  │  │
│  │     detect diversion but cannot prevent it.                            │  │
│  │     Advance rate   25% of tier base       Repayment  behavioural       │  │
│  │     Requires a security bond. Limit never exceeds reserve + bond.      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   REVENUE ROUTER                                                             │
│   ( ) Link an existing router   [ 0x…                                     ]  │
│   (•) Deploy a new router for this service                                   │
│                                                                              │
│   Repayment share  20%  [▓▓░░░░░░░░]   Reserve share  2%   Operating  78%    │
│   └─ At 20% and a 45-day horizon your maximum advance rate is 30%.           │
│      Raising the repayment share raises your advance rate.  ( Model it )     │
│                                                                              │
│                                       ( Back )   [ Deploy router · ~0.02 ]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Custody model | User selection | STATIC | CHAIN |
| Advance-rate multiplier | Protocol table, PRD §11.3 | STATIC | PUB |
| Router address | Deployed or linked | EVT | CHAIN |
| Repayment / reserve / operating split | User within protocol bounds | ASSESS | CHAIN |
| Implied max advance rate | `repaymentBps/10,000 × T_max/30`, PRD §13.4 | RT | BOR |
| Deployment gas estimate | Arc gas oracle | RT | BOR |
| Bond requirement | Derived from custody model and tier | STATIC | BOR |

**Post-deploy** — the app returns to S-11's probe and re-runs it, this time expecting `payTo == router`. Onboarding cannot complete until that probe passes.

---

## 7.4 S-13 — Costs, operating wallet, terms

**Route** `/onboard/terms` · **PRD** §13.10, §22.8

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Register a service                              Step 4 of 4  ▓▓▓▓▓ │
├──────────────────────────────────────────────────────────────────────────────┤
│   OPERATING WALLET                                                           │
│   Destination for your 78% revenue share and for borrowed funds.             │
│   [ 0x2b18…9e04  Circle Agent Wallet                                     ▾ ] │
│   ● Policy-controlled  ·  daily cap 500.00  ·  per-tx cap 100.00             │
│                                                       ( Edit policy → S-30 ) │
│                                                                              │
│   COST STRUCTURE                                                             │
│   Category band for "Data lookup and static datasets": 10% – 50% of price    │
│                                                                              │
│   Average price per request   [ 0.040 ] USDC                                 │
│   Declared cost per request   [ 0.014 ] USDC   = 35.0% of price   ✓ in band  │
│                                                                              │
│   Operating-capacity factor M            0.88                                │
│   Ceiling on M while costs are unverified   0.95                             │
│   └─ Route your own upstream purchases through Rivora-observable rails to    │
│      lift this ceiling. Fully observed cost base removes it entirely.        │
│                                                                              │
│   TERMS                                                                      │
│   [x] I understand credit limits are dynamic and may be reduced.             │
│   [x] I understand my Revenue Router's total throughput is publicly          │
│       visible onchain. Payer identity and per-customer split are not.        │
│   [x] I understand defaults are recorded permanently and may be cured but    │
│       not removed.                                                           │
│   [x] I accept the protocol terms and testnet disclaimer.                    │
│                                                                              │
│                                       ( Back )   [ Complete registration ]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Operating wallet, policy summary | Agent Wallet API | RT | BOR |
| Category cost band | Protocol table, PRD §13.10 | STATIC | PUB |
| Declared price and cost per request | User input, validated against band | STATIC | OPS |
| In-band indicator | Derived | RT | BOR |
| Factor M and its ceiling | Underwriting engine | ASSESS | BOR |
| Terms acceptance | Signed message, stored with timestamp | STATIC | OPS |

**Design note** — the router-throughput disclosure is a required checkbox, not fine print. PRD §21.4 makes the point that a borrower who discovers this after routing six months of revenue is a borrower lost, and the disclosure costs nothing made up front.

---

## 7.5 S-14 — Observation state

**Route** `/dashboard` while status is OBSERVATION · **PRD** §16.2

The first screen a new borrower sees, and the one they will see for 30 days. It must make waiting feel like progress.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA    Dashboard  Revenue  Custody  Policy                    ● OBSERVING│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Building your credit profile                                               │
│   Rivora is observing your revenue. You cannot borrow yet.                   │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │  REQUIREMENT                    PROGRESS                     STATUS  │   │
│   │  ──────────────────────────────────────────────────────────────────  │   │
│   │  30 days of revenue history     [▓▓▓▓▓▓▓░░░]  21 / 30        ⏱ 9 d   │   │
│   │  100 eligible paid requests     [▓▓▓▓▓▓▓▓▓▓]  4,120 / 100    ✓       │   │
│   │  10 independent customers       [▓▓▓▓▓▓▓▓▓▓]  38 / 10        ✓       │   │
│   │  90% successful fulfilment      [▓▓▓▓▓▓▓▓▓░]  94.1%          ✓       │   │
│   │  Endpoint binding verified      [▓▓▓▓▓▓▓▓▓▓]  probe passing  ✓       │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ESTIMATED FIRST CREDIT LIMIT                                               │
│   ~1,690 USDC        based on 21 days of data, extrapolated                  │
│   Indicative only. The first binding assessment runs on 2026-08-11.          │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │ Revenue observed so far                                              │   │
│   │  600 ┤                                    ▄▄  ▄▄▄                    │   │
│   │  400 ┤              ▄▄  ▄▄▄  ▄▄▄▄▄▄  ▄▄▄▄▄██▄▄███▄                   │   │
│   │  200 ┤    ▄▄▄▄▄▄▄▄▄▄██▄▄███▄▄██████▄▄█████████████                   │   │
│   │    0 ┼────────────────────────────────────────────────               │   │
│   │      Jul 12                                       Aug 02             │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│                    ( See what would raise my limit )   ( Revenue detail )    │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Days of history | First eligible revenue timestamp | 10s | BOR |
| Eligible paid requests | Indexer count | 10s | BOR |
| Independent customers | Indexer, post-clustering | 10s | BOR |
| Fulfilment rate | Settlement success ratio | 10s | BOR |
| Binding probe status | Probe scheduler | 10s | BOR |
| Indicative limit | Underwriting engine, dry-run mode | 10s | BOR |
| Revenue series | Daily aggregates | 10s | BOR |

**States** — any requirement failing renders in amber with the specific shortfall. A failed binding probe blocks progression entirely and links to S-29.

---
# 8. Borrower core screens

## 8.1 S-20 — Borrower dashboard

**Route** `/dashboard` · **PRD** §29.2

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA    Dashboard  Revenue  Credit  Custody  Policy  Reserve      ⌄ 0x5d92│
│                                                          ● Strong · Score 78 │
├──────────────────────────────────────────────────────────────────────────────┤
│  QuoteStream Market Data API                     Custody A ✓ · Coverage 0.98 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┬───────────────────────┬────────────────────────┐  │
│  │ AVAILABLE CREDIT      │ OUTSTANDING DEBT      │ RISK SCORE             │  │
│  │                       │                       │                        │  │
│  │   530.00 USDC         │  2,008.42 USDC        │   78 ▲10               │  │
│  │   of 2,530.00 limit   │  principal  2,000.00  │   Strong               │  │
│  │   [▓▓░░░░░░░░] 20.9%  │  interest       8.42  │   [▓▓▓▓▓▓▓▓░░]         │  │
│  └───────────────────────┴───────────────────────┴────────────────────────┘  │
│  ┌───────────────────────┬───────────────────────┬────────────────────────┐  │
│  │ INTEREST RATE         │ 30-DAY ELIGIBLE REV.  │ NEXT REPAYMENT         │  │
│  │                       │                       │                        │  │
│  │   10.71% APR          │  13,500.00 USDC ▲35%  │   ~90.00 USDC          │  │
│  │   r(U) 7.71 + 3.00    │  gross 14,040.00      │   at next settlement   │  │
│  │   Strong premium      │  excluded   540.00    │   ⏱ in ~3h 20m        │   │
│  └───────────────────────┴───────────────────────┴────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│  REVENUE ALLOCATION — every 100 USDC that settles                            │
│                                                                              │
│    Repayment  20%  ████████                        20.00 USDC → Credit Vault │
│    Reserve     2%  ▓                                2.00 USDC → Loss reserve │
│    Operating  78%  ████████████████████████████    78.00 USDC → 0x2b18…9e04  │
│                                                                              │
│    At 450.00 USDC/day you repay ~90.00/day. Projected payback 22 days.       │
├──────────────────────────────────────────────────────────────────────────────┤
│  CREDIT LIMIT HISTORY                                     ( Full history → ) │
│                                                                              │
│   3,000 ┤                                        ┌─────── 2,530              │
│   2,000 ┤                                        │                           │
│   1,000 ┤            ┌───────────────────────────┘ 1,690                     │
│       0 ┼────────────┘                                                       │
│         Jun 03      Jul 03                     Aug 01                        │
│                     ▲ assessment 1              ▲ assessment 2               │
├──────────────────────────────────────────────────────────────────────────────┤
│  SERVICE HEALTH                          │  RISK WARNINGS                    │
│  Uptime probe        99.4%   ✓           │  ⚠ Concentration MODERATE         │
│  Settlement success  96.2%   ✓           │    Largest payer 14% of revenue.  │
│  Median latency       184ms  ✓           │    Above 40% caps your limit.     │
│  Refund rate           0.9%  ✓           │                                   │
│  Binding probe    2m ago     ✓           │  ⓘ Costs unverified               │
│  Coverage ratio        0.98  ✓           │    M is capped at 0.95. Route     │
│  Interest coverage    104.2  ✓           │    upstream spend through Rivora. │
├──────────────────────────────────────────┴───────────────────────────────────┤
│              [ Borrow USDC ]    ( Repay manually )    ( Why this limit? )    │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Available credit | `limit − principal − pendingDraws`, PRD §10.4 | EVT | BOR |
| Approved limit | `BorrowerAccount.creditLimit` | ASSESS | CHAIN |
| Outstanding principal | `normalizedDebt × borrowIndex` | RT | CHAIN |
| Accrued interest | Derived from index delta | RT | CHAIN |
| Risk score, tier, delta | `RiskRegistry` latest vs. previous | ASSESS | CHAIN |
| Interest rate breakdown | `r(U)` + tier premium, PRD §15.3 | 10s | BOR |
| 30-day eligible revenue | Underwriting engine, normalized | 10s | BOR |
| Gross and excluded revenue | Indexer | 10s | BOR |
| Next repayment estimate | Mean settlement batch × repaymentBps | 10s | BOR |
| Time to next settlement | Observed batch cadence | RT | BOR |
| Allocation split | `BorrowerAccount.repaymentBps / reserveBps` | ASSESS | CHAIN |
| Projected payback | `P / (R_daily × repaymentBps)`, PRD §13.4 | 10s | BOR |
| Limit history series | Assessment history | ASSESS | BOR |
| Uptime, latency | Rivora probe scheduler | 10s | BOR |
| Settlement success, refund rate | Payment feed | 10s | BOR |
| Binding probe age and result | Probe scheduler | RT | BOR |
| Coverage ratio | PRD §11.5 | 10s | BOR |
| Interest coverage | PRD §15.5 | 10s | BOR |
| Risk warnings | Active trigger list with reason codes | RT | BOR |

**Actions**

| Action | Gate |
| --- | --- |
| Borrow USDC | Status ∈ {ACTIVE, ELIGIBLE}, available credit > 0, vault above buffer floor |
| Repay manually | Outstanding debt > 0 |
| Why this limit? | Always available → S-27 |

**States** — OBSERVATION renders S-14 instead. WATCH, RESTRICTED, DELINQUENT and DEFAULTED render the S-32 banner variants above this content and disable the borrow action.

---

## 8.2 S-21 — Revenue analytics

**Route** `/revenue` · **PRD** §29.3, §22.2

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Revenue                        Window [ 30 days ▾ ]  ( Export CSV )│
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┬────────────────┬────────────────┬────────────────────┐   │
│  │ GROSS          │ ELIGIBLE       │ EXCLUDED       │ GROWTH             │   │
│  │ 14,040.00 USDC │ 13,500.00 USDC │   540.00 USDC  │  +35.0% ▲          │   │
│  │                │ normalized     │ 3.8% of gross  │  vs prior 30 days  │   │
│  └────────────────┴────────────────┴────────────────┴────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│  DAILY REVENUE                          ▓ eligible   ░ excluded              │
│                                                                              │
│  600 ┤                                              ▓▓                       │
│  500 ┤                        ▓▓      ▓▓  ▓▓░ ▓▓  ▓▓▓▓░ ▓▓  ▓▓               │
│  400 ┤    ▓▓  ▓▓░ ▓▓  ▓▓▓▓  ▓▓▓▓░ ▓▓▓▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓ ▓▓▓               │
│  300 ┤ ▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓ ▓▓▓               │
│  200 ┤ ▓▓ ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓ ▓▓▓               │
│    0 ┼─────────────────────────────────────────────────────────────          │
│      Jul 03                                                    Aug 01        │
│         mean 450.00   median 441.00   σ 61.20   CV 0.136                     │
│         ─ ─ ─ ─ ─ time-weighted normalized base 13,500.00 ─ ─ ─ ─ ─          │
├──────────────────────────────────────────────────────────────────────────────┤
│  REQUESTS                              │  CUSTOMERS                          │
│  Authorizations issued      351,000    │  Unique eligible payers       386   │
│  Settled successfully       337,500    │  Repeat payers                168   │
│  Failed / unfulfilled        13,500    │  Repeat rate                43.5%   │
│  Refunded                       126    │  New payers this window        94   │
│  Success ratio               96.2% ▲   │  Median payer lifetime      31 d    │
│  Mean price per request      0.040     │  Largest payer share         14%    │
├────────────────────────────────────────┴─────────────────────────────────────┤
│  UNDERWRITING FACTORS                              ( How these are used → )  │
│                                                                              │
│   S  Service reliability     0.95  ████████████████████░   penalty  1.50 pts │
│   C  Customer concentration  0.86  ██████████████████░░░   penalty  3.50 pts │
│   V  Revenue volatility      0.90  ███████████████████░░   penalty  1.50 pts │
│   D  Revenue diversity       0.95  ████████████████████░   penalty  0.75 pts │
│   M  Operating capacity      0.88  ██████████████████░░░   penalty  1.80 pts │
│                                                            ───────────────── │
│   Quality factor Q                                         0.9095            │
│   G  Revenue growth          1.10  (uplift, capped)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│         ( Excluded revenue → )    ( Customer concentration → )               │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Gross, eligible, excluded revenue | Indexer + eligibility engine | 10s | BOR |
| Normalized base | Time-weighted with median clamp, PRD §13.2 | 10s | BOR |
| Growth | vs. prior 30-day window | 10s | BOR |
| Daily series, eligible vs. excluded | Daily aggregates | 10s | BOR |
| Mean, median, σ, CV | Derived from daily series | 10s | BOR |
| Request counts and success ratio | Payment feed | 10s | BOR |
| Refund count | Payment feed | 10s | BOR |
| Mean price per request | Gross ÷ settled count | 10s | BOR |
| Unique, repeat, new payers | Customer aggregates, post-clustering | 10s | BOR |
| Median payer lifetime | Customer aggregates | 10s | BOR |
| Largest payer share | Customer aggregates | 10s | BOR |
| Factor values and penalty points | Underwriting engine | ASSESS | BOR |
| Quality factor Q | Underwriting engine, PRD §13.3 | ASSESS | BOR |
| Individual payer addresses | — | — | **NEVER** on this screen |

**Acceptance** — PRD §22.2 requires that the dashboard updates after a payment event and that revenue calculations are reproducible from stored events. The export produces the raw event set backing every figure above.

---

## 8.3 S-22 — Excluded revenue detail

**Route** `/revenue/excluded` · **PRD** §22.2 ("excluded revenue includes a reason")

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Excluded revenue                    Window 2026-07-03 → 2026-08-01 │
├──────────────────────────────────────────────────────────────────────────────┤
│  540.00 USDC excluded from 14,040.00 gross  ·  3.8%                          │
│                                                                              │
│   Related-wallet payments        310.00  ████████████████████  57.4%         │
│   Unfulfilled paid requests      104.00  ███████              19.3%          │
│   Refunded requests              126.00  ████████             23.3%          │
│   Wash-activity detection          0.00                        0.0%          │
│   Unseasoned (< 3 days)            0.00                        0.0%          │
├──────────────────────────────────────────────────────────────────────────────┤
│  EVENTS                                    Filter [ All reasons ▾ ]          │
│  ─────────────────────────────────────────────────────────────────────────── │
│  PAID AT     PAYER          AMOUNT   REASON                          TX      │
│  Jul 29 11:02 0x3d91…7a2c    82.40   Related wallet — funded by      ⧉ 0x9c… │
│               ▸ payer first funded by 0x2b18…9e04 on Jul 22, 7 days          │
│                 before first payment. Common funding source.                 │
│  Jul 27 08:44 0x3d91…7a2c   118.60   Related wallet — funded by      ⧉ 0x71… │
│  Jul 26 19:20 0x88b0…31de   109.00   Related wallet — circular flow  ⧉ 0x2f… │
│  Jul 25 14:07 0xc410…9902    46.80   Refunded 2026-07-25 15:11       ⧉ 0x55… │
│  Jul 24 09:33 0x71aa…0c48    38.20   Request unfulfilled — 503       ⧉ 0x8d… │
│               ▸ request_id req_8812fa · endpoint returned 503 after payment  │
│  Jul 22 16:58 0xc410…9902    79.56   Refunded 2026-07-22 18:02       ⧉ 0x1b… │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                    ( Load more )  ( Dispute )│
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Exclusion totals by reason | Eligibility engine | 10s | BOR |
| `paidAt` | Payment feed, authorization time | EVT | BOR |
| Payer wallet | Indexer — visible to the borrower only | EVT | BOR |
| Amount | Payment feed | EVT | BOR |
| `exclusionReason` | Eligibility engine enum | EVT | BOR |
| Reason evidence | Funding-graph analysis, refund record, request outcome | EVT | BOR |
| `requestId` | x402 correlation | EVT | BOR |
| Transaction hash | Settlement receipt | EVT | CHAIN |

**Actions** — Dispute opens a review request routed to the risk console (S-52). Disputes do not alter the limit while open; the assessment record notes an open dispute.

---

## 8.4 S-23 — Customer concentration

**Route** `/revenue/customers` · **PRD** §13.7

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Customer concentration                              Window 30 days │
├──────────────────────────────────────────────────────────────────────────────┤
│  HHI  0.14         Band MODERATE         Factor C  0.86    penalty 3.50 pts  │
│                                                                              │
│  Concentration ceilings                                                      │
│   Largest payer  14%  [▓▓▓░░░░░░░░░░░░░░░░░]                                 │
│                       0%          40%       60%       80%      100%          │
│                                    │         │         │                     │
│                                    │         │         └ no new draws        │
│                                    │         └ WATCH-tier limits only        │
│                                    └ limit capped at new-borrower cap        │
├──────────────────────────────────────────────────────────────────────────────┤
│  TOP PAYERS                                              ▓ eligible          │
│                                                                              │
│   payer_a1  ████████████████  14.0%   1,890.00 USDC   132 payments  61 d     │
│   payer_b7  ███████████       9.6%    1,296.00 USDC    94 payments  58 d     │
│   payer_c2  █████████         7.8%    1,053.00 USDC    77 payments  44 d     │
│   payer_d9  ███████           6.1%      823.50 USDC    61 payments  39 d     │
│   payer_e4  █████             4.4%      594.00 USDC    48 payments  31 d     │
│   382 others ████████████████████████████████████████████ 58.1%              │
│                                                                              │
│   Payer labels are stable pseudonyms. Wallet addresses are available in      │
│   the CSV export and are never displayed onchain or to liquidity providers.  │
├──────────────────────────────────────────────────────────────────────────────┤
│  UPSTREAM CONCENTRATION                                        ⓘ  Declared   │
│   Model provider A     62% of declared cost base                             │
│   GPU marketplace B    24%                                                   │
│   Storage C            14%                                                   │
│   Recorded for reporting. Applied as a portfolio-level haircut in            │
│   production, not a per-borrower one.                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| HHI, band, factor C | Underwriting engine, PRD §13.7 | ASSESS | BOR / band only to PUB |
| Ceiling thresholds | Protocol constants | STATIC | PUB |
| Per-payer share, revenue, count, age | Customer aggregates | 10s | BOR |
| Payer pseudonym | Stable salted label | 10s | BOR |
| Payer wallet address | Access-controlled store | on export | BOR |
| Upstream concentration | Borrower-declared | STATIC | OPS |

---

## 8.5 S-24 — Credit

**Route** `/credit` · **PRD** §29.4

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Credit                                          ● Strong · Score 78│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Approved credit limit                                  2,530.00 USDC       │
│   Outstanding principal                                − 2,000.00 USDC       │
│   Pending draw requests                                −     0.00 USDC       │
│                                                        ───────────────       │
│   Available credit                                         530.00 USDC       │
│                                                                              │
│   Accrued interest                                           8.42 USDC       │
│   Total owed                                             2,008.42 USDC       │
│                                                                              │
│   [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░]  79.1% drawn             │
├──────────────────────────────────────────────────────────────────────────────┤
│  TERMS                                  │  CAPACITY CHECKS                   │
│  Borrower tier          Strong          │  Interest coverage    104.2   ✓    │
│  Risk premium            3.00%          │  required ≥ 3.0                    │
│  Vault base rate         7.71%          │  Projected payback  22 days   ✓    │
│  Your rate              10.71% APR      │  max 60 days (Strong)              │
│  Repayment share           20%          │  Stressed payback   32 days   ✓    │
│  Reserve share              2%          │  max 90 days at −30% revenue       │
│  Reserve balance        248.60          │  Vault buffer         66.1%   ✓    │
│  Reserve target         253.00          │  floor 15%                         │
│  Reserve coverage        98.3%          │  Coverage ratio        0.98   ✓    │
├─────────────────────────────────────────┴────────────────────────────────────┤
│  WHY 2,530 AND NOT MORE                                                      │
│                                                                              │
│   Quality-derived limit        13,500 × 0.30 × 0.9095 × 1.10  =  4,051       │
│   Repayment-horizon limit      13,500 × 0.20 × (60/30)        =  9,000       │
│   Stressed-horizon limit       (13,500 × 0.70) × 0.20 × 3     = 18,900       │
│   Custody cap (Model A)        no reduction                   =  9,000       │
│   Tier cap (Strong)                                           = 50,000       │
│   Exposure cap (5% of vault)                                  =  1,250  ⚠    │
│   Per-assessment growth cap    1,690 × 1.50                   =  2,535  ◄    │
│                                                                ───────────── │
│   Approved = min(...)                                          =  2,530      │
│                                                                              │
│   ◄ binding    ⚠ would bind at a larger vault utilization                    │
├──────────────────────────────────────────────────────────────────────────────┤
│    [ Borrow USDC ]   ( Repay manually )   ( Decision explanation )           │
│                                           ( Limit history )                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Approved limit, principal, pending draws | `BorrowerAccount` | EVT | CHAIN |
| Accrued interest | Borrow index delta | RT | CHAIN |
| Tier, premium, base rate, borrower rate | `RiskRegistry` + `r(U)` | 10s | BOR |
| Repayment / reserve share | `BorrowerAccount` | ASSESS | CHAIN |
| Reserve balance, target, coverage | Router reserve accounting | EVT | BOR |
| Interest coverage | PRD §15.5 | 10s | BOR |
| Projected and stressed payback | PRD §13.4 | 10s | BOR |
| Vault buffer | `CreditVault` | 10s | LP/PUB |
| All constraint values | Underwriting engine constraint set | ASSESS | BOR |
| Binding constraint flag | Underwriting engine | ASSESS | BOR/PUB label |

**Design note** — the constraint ladder is the most important block on this screen. PRD §14.5 makes the point that a borrower told only the final number will try to improve metrics that are not the constraint. Showing every candidate limit and marking the binding one converts a black box into an instruction.

---

## 8.6 S-25 — Draw request

**Route** `/credit/draw` · **PRD** §22.4, §15.5

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Borrow USDC                                                            [ ✕ ]│
├──────────────────────────────────────────────────────────────────────────────┤
│   Available credit  530.00 USDC                                              │
│                                                                              │
│   Amount            [ 400.00                                       ] USDC    │
│                     [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 25 · 50 · MAX  │
│                                                                              │
│   Use of funds      [ Model and data API expenses                        ▾ ] │
│                     compute · data · storage · security · devops             │
│                                                                              │
│   Destination       [ 0x2b18…9e04  Operating wallet (registered)         ▾ ] │
│                     ✓ On the allowlist. Non-registered destinations require  │
│                       a policy change and a 24h delay.                       │
│                                                                              │
│   Expected repayment period  [ 30 days ▾ ]                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│   POLICY AND PROTOCOL CHECKS                                                 │
│   ✓ Credit line is ACTIVE                                                    │
│   ✓ 400.00 within available credit of 530.00                                 │
│   ✓ Vault liquidity 16,530.00, buffer stays at 64.5% (floor 15%)             │
│   ✓ Borrower is not restricted                                               │
│   ✓ Destination is allowed                                                   │
│   ✓ Category "data" is permitted by wallet policy                            │
│   ✓ Revenue Router active, binding probe passing (2m ago)                    │
│   ✓ Interest coverage after draw  86.8  (≥ 3.0 required)                     │
│   ✓ Projected payback after draw  27 days  (≤ 60)                            │
│   ✓ Below human-approval threshold of 250.00 … ⚠ EXCEEDS — see below         │
├──────────────────────────────────────────────────────────────────────────────┤
│   ⚠ HUMAN APPROVAL REQUIRED                                                  │
│     400.00 exceeds the 250.00 agent policy threshold. This draw will be      │
│     queued for owner-wallet signature from 0x5d92…3ba6.                      │
├──────────────────────────────────────────────────────────────────────────────┤
│   COST OF THIS DRAW                                                          │
│   Principal                                              400.00 USDC         │
│   Origination fee 0.25%                                    1.00 USDC         │
│   Interest at 10.71% over 27 days                          3.17 USDC         │
│                                                          ─────────────       │
│   Estimated total repayment                              404.17 USDC         │
│   Repaid automatically from ~90.00/day of routed revenue                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                              ( Cancel )     [ Request 400.00 USDC ]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Available credit | `BorrowerAccount` | RT | BOR |
| Use-of-funds categories | Wallet policy allowlist | STATIC | BOR |
| Destination allowlist | Agent Wallet policy | RT | BOR |
| Each protocol check | `CreditManager` simulation call | RT | BOR |
| Post-draw buffer | `CreditVault` simulation | RT | BOR |
| Post-draw interest coverage | PRD §15.5, evaluated onchain | RT | BOR |
| Post-draw payback projection | PRD §13.4 | RT | BOR |
| Human-approval threshold | Agent Wallet policy | STATIC | BOR |
| Origination fee | Protocol parameter, PRD §39.2 | STATIC | PUB |
| Interest estimate | Rate × amount × period | RT | BOR |

**Confirmation state**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│   ✓ 400.00 USDC transferred                                                  │
│                                                                              │
│   ⧉ 0x4a71…9f30   Arc · block 8,204,119 · finalized 0.6s                     │
│                                                                              │
│   Outstanding principal   2,000.00 → 2,400.00 USDC                           │
│   Available credit          530.00 →   130.00 USDC                           │
│   Vault liquidity        16,530.00 → 16,130.00 USDC                          │
│   Projected payback         22 → 27 days                                     │
│                                                                              │
│                              ( View on explorer )     [ Done ]               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Failure states** — insufficient available credit, vault below buffer floor, coverage below 3.0, borrower restricted, destination not allowed, binding probe stale. Each renders the specific failing check in red with the numeric shortfall, never a generic error.

---

## 8.7 S-26 — Manual repayment

**Route** `/credit/repay` · **PRD** §22.5

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Repay manually                                                         [ ✕ ]│
├──────────────────────────────────────────────────────────────────────────────┤
│   Total owed        2,008.42 USDC                                            │
│     Accrued interest    8.42                                                 │
│     Principal       2,000.00                                                 │
│                                                                              │
│   Amount            [ 2,008.42                                     ] USDC    │
│                     ( 500 )  ( 1,000 )  [ Repay in full ]                    │
│                                                                              │
│   From wallet       [ 0x2b18…9e04  Operating wallet · 3,120.44 USDC      ▾ ] │
├──────────────────────────────────────────────────────────────────────────────┤
│   APPLICATION ORDER                                                          │
│   1  Accrued interest                                        8.42 USDC       │
│   2  Outstanding principal                               2,000.00 USDC       │
│   3  Excess returned to operating wallet                     0.00 USDC       │
│                                                                              │
│   After this repayment                                                       │
│     Outstanding debt        2,008.42 → 0.00 USDC                             │
│     Available credit          530.00 → 2,530.00 USDC                         │
│     Status                    ACTIVE → REPAID                                │
│     Revenue allocation        20/2/78 → 0/2/98 until reserve target met      │
│                                                                              │
│   ⓘ Full repayment triggers reassessment and updates your reputation record. │
├──────────────────────────────────────────────────────────────────────────────┤
│                              ( Cancel )     [ Repay 2,008.42 USDC ]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Total owed, interest, principal | `BorrowerAccount` + index | RT | CHAIN |
| Source wallet balance | Arc RPC | RT | BOR |
| Application order preview | `RevenueRouter` waterfall logic | RT | BOR |
| Post-repayment state | Simulation | RT | BOR |
| Waterfall when debt reaches zero | PRD §12.3 | STATIC | PUB |

**Acceptance** — PRD §22.5 requires total distributed to equal revenue received, no double distribution, and excess returned to the borrower. The preview shows all three before signing.

---

## 8.8 S-27 — Assessment explanation

**Route** `/credit/assessment/:id` · **PRD** §14.5, §33 explainability

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Assessment #2                    2026-08-01 12:47 UTC  ⧉ 0x39d5…   │
├──────────────────────────────────────────────────────────────────────────────┤
│   Credit limit increased from 1,690.00 to 2,530.00 USDC                      │
│   Risk score 68 → 78          Tier  Standard → Strong                        │
│   Model riv-uw-2.1   ·   Evidence 0x2f81…7cd0   ·   Nonce 14   ·   Valid 24h │
├──────────────────────────────────────────────────────────────────────────────┤
│   POSITIVE FACTORS                                                           │
│   + Normalized 30-day eligible revenue increased 35% (10,000 → 13,500 USDC)  │
│   + Settlement success ratio improved from 88% to 96%                        │
│   + Repeat payers increased from 95 to 168                                   │
│   + Largest payer share fell from 22% to 14%                                 │
│   + Tier advance rate increased from 20% to 30%                              │
│                                                                              │
│   LIMITING FACTORS          contribution to the 9.05% quality haircut        │
│   − Customer concentration                                       3.50 pts    │
│   − Operating capacity, costs unverified                         1.80 pts    │
│   − Revenue volatility                                           1.50 pts    │
│   − Service reliability                                          1.50 pts    │
│   − Customer diversity                                           0.75 pts    │
│                                                                  ─────────   │
│                                                                  9.05 pts    │
│                                                                              │
│   BINDING CONSTRAINT                                                         │
│   Per-assessment growth cap.  1,690.00 × 1.50 = 2,535.00                     │
│   Quality-derived limit was 4,051.00 USDC.                                   │
│   A further increase is available at the next assessment if performance      │
│   holds. Improving quality factors will not raise the limit this cycle.      │
├──────────────────────────────────────────────────────────────────────────────┤
│   ARITHMETIC                                            ( Reproduce → CSV )  │
│                                                                              │
│   Q = 1 − [0.30(0.05) + 0.25(0.14) + 0.15(0.10)                              │
│          + 0.15(0.05) + 0.15(0.12)]        = 0.9095                          │
│   L_quality = 13,500 × 0.30 × 0.9095 × 1.10 = 4,051.00                       │
│   Growth cap = 1,690 × 1.50                 = 2,535.00   ◄ binds             │
│   Approved                                  = 2,530.00                       │
├──────────────────────────────────────────────────────────────────────────────┤
│   ONCHAIN VALIDATION                                                         │
│   ✓ Signer authorized       0xA9…  underwriter key 3                         │
│   ✓ Nonce 14 unused                                                          │
│   ✓ Not expired             valid until 2026-08-02 12:47 UTC                 │
│   ✓ Within protocol caps    recommended 2,530 ≤ tier cap 50,000              │
│   ✓ Credit Manager approved 2,530.00 (recommendation not reduced)            │
│                                                                              │
│   ⓘ The AI-generated narrative above is produced from these numbers. It      │
│     never determines them. The contract accepts a recommendation only if it  │
│     is within protocol bounds, and may approve less but never more.          │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Limit before / after, score, tier | `RiskAssessment` | ASSESS | CHAIN |
| Model version, evidence hash, nonce, expiry | `RiskAssessment` | ASSESS | CHAIN |
| Positive and limiting factors | Generated from factor deltas | ASSESS | BOR |
| Penalty points per factor | `wᵢ × (1 − fᵢ) × 100` | ASSESS | BOR |
| Binding constraint | Constraint set argmin | ASSESS | BOR |
| Full arithmetic | Underwriting engine trace | ASSESS | BOR |
| Signature validation results | `RiskRegistry` verification | ASSESS | CHAIN |
| Recommendation vs. approved | `RiskRegistry` vs. `CreditManager` | ASSESS | CHAIN |

**Acceptance** — PRD §22.3 requires the limit calculation to be deterministic for the same input set. "Reproduce → CSV" exports the exact signal set committed to by `evidenceHash`, so a third party can recompute the limit independently.

---

## 8.9 S-28 — Credit limit history

**Route** `/credit/history` · **PRD** §22.3

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Credit limit history                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  3,000 ┤                                              ┌──────── 2,530        │
│  2,000 ┤                                              │                      │
│  1,000 ┤                    ┌─────────────────────────┘ 1,690                │
│      0 ┼────────────────────┘                                                │
│        Jun 03        Jul 03                          Aug 01                  │
│                        ▲ #1                            ▲ #2                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  DATE        #   LIMIT      Δ        SCORE  TIER      BINDING        TX      │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Aug 01 12:47 2  2,530.00  +840.00   78 ▲10 Strong    growth cap    ⧉ 0x39d5 │
│  ▸ quality limit 4,051 · horizon 9,000 · exposure 1,250 · growth 2,535       │
│  Jul 03 09:12 1  1,690.00  +1,690    68     Standard  quality       ⧉ 0xc18a │
│  ▸ quality limit 1,698 · horizon 3,000 · new-borrower cap 2,500              │
│  Jun 03 16:40 0      0.00        —    —     Observation  —          ⧉ 0x7b44 │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Next scheduled assessment  2026-08-02 12:47 UTC   ⏱ in 22h 14m              │
│  Assessments also trigger on: material revenue change, default warning,      │
│  large refund, suspicious activity, complete repayment.                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Assessment series | `RiskRegistry` history | ASSESS | CHAIN |
| Limit, delta, score, tier per row | `RiskAssessment` | ASSESS | CHAIN |
| Binding constraint label | Assessment record | ASSESS | BOR |
| Full constraint ladder per row | Assessment record, expandable | ASSESS | BOR |
| Next scheduled assessment | Agent orchestrator schedule | RT | BOR |
| Trigger conditions | Protocol constants, PRD §16.6 | STATIC | PUB |

---

## 8.10 S-29 — Custody and endpoint binding

**Route** `/custody` · **PRD** §11.4, §11.5

The screen that proves the credit is safe. It is also the borrower's own monitoring tool.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Custody and binding                                    ● VERIFIED  │
├──────────────────────────────────────────────────────────────────────────────┤
│  CUSTODY MODEL A — Router is the settlement destination                      │
│  Advance rate multiplier 100% of tier base · Repayment structural            │
│                                                       ( Change model )       │
├──────────────────────────────────────────────────────────────────────────────┤
│  BINDING                                                                     │
│   Endpoint          https://api.quotestream.dev/v1                           │
│   Revenue Router    0x7f3a…c1d2                                              │
│   Binding hash      0x3b7d…e922      keccak256(endpoint, router, owner)      │
│   Bound since       2026-06-03 16:40 UTC                    ⧉ 0x7b44…21ef    │
├──────────────────────────────────────────────────────────────────────────────┤
│  LIVE PROBE                                     next probe in 3m 12s         │
│                                                                              │
│   14:29:41  GET /v1/quote (unpaid)  →  402 Payment Required                  │
│             advertised payTo   0x7f3a…c1d2                                   │
│             bound router       0x7f3a…c1d2               ✓ MATCH             │
│             price 0.040 USDC · asset USDC · chain Arc                        │
│             latency 184ms                                                    │
│                                                                              │
│   PROBE HISTORY, 24h                                                         │
│   ✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓  288/288  100%               │
├──────────────────────────────────────────────────────────────────────────────┤
│  ROUTED-REVENUE COVERAGE                                                     │
│                                                                              │
│   Expected routed revenue    13,770.00 USDC   337,500 requests × 0.0408 mean │
│   Actual routed revenue      13,500.00 USDC                                  │
│   Coverage ratio                     0.98     ✓ consistent                   │
│                                                                              │
│   1.00 ┤▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                                 │
│   0.95 ┤            ▁▁▁                    ▁▁▁▁                              │
│   0.80 ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  review threshold             │
│   0.50 ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  diversion threshold          │
│        Jul 03                                    Aug 01                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  SETTLEMENT                                                                  │
│   Mean batch interval       6h 12m        Last settlement  11:19 UTC         │
│   Mean batch size          115.40 USDC    Next expected    ~17:31 UTC        │
│   Unsettled authorizations  84.20 USDC    Grace period      21 days          │
│   └─ Counted for underwriting at paidAt, not yet available for repayment.    │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Custody model and multiplier | Binding record | STATIC | CHAIN |
| Endpoint, router, binding hash | Binding record | STATIC | CHAIN (endpoint hashed) |
| Probe result, advertised `payTo` | Probe scheduler | RT | BOR |
| Probe success history | Probe log | RT | BOR |
| Expected vs. actual routed revenue | PRD §11.5 | 10s | BOR |
| Coverage ratio and thresholds | PRD §11.5 | 10s | BOR / band to OPS |
| Batch interval, size, last, next | Settlement observation | RT | BOR |
| Unsettled authorizations | `paidAt` minus `settledAt` set | RT | BOR |

**Alarm state** — on `payTo` mismatch the entire screen turns to the failure state, the borrower is moved to RESTRICTED immediately, and the banner reads:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⛔ BINDING BROKEN — advertised payTo no longer matches your Revenue Router   │
│    advertised  0x91bd…7702        bound  0x7f3a…c1d2                         │
│    Detected 14:29:41 UTC. New draws are blocked and the repayment share has  │
│    been raised to 35%. Restore the binding within 7 days to avoid default.   │
│                                              [ Re-verify ]  ( Contact ops )  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8.11 S-30 — Agent spending policy

**Route** `/policy` · **PRD** §22.8, §31.3

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Agent spending policy               Wallet 0x2b18…9e04 · Circle    │
├──────────────────────────────────────────────────────────────────────────────┤
│  LIMITS                                                                      │
│   Maximum individual payment      [   100.00 ] USDC                          │
│   Maximum daily spending          [   500.00 ] USDC   used today  182.40     │
│                                   [▓▓▓▓░░░░░░░░░░░░░░░░] 36.5%               │
│   Human approval threshold        [   250.00 ] USDC                          │
│                                                                              │
│  ALLOWED CATEGORIES                                                          │
│   [x] compute      [x] data       [x] storage                                │
│   [ ] marketing    [ ] payroll    [x] security & monitoring                  │
│                                                                              │
│  RECIPIENT ALLOWLIST                                          ( + Add )      │
│   0xf120…88ab   Model provider A          compute      last used 2h ago      │
│   0x9a03…14dd   GPU marketplace B         compute      last used 1d ago      │
│   0x77c1…6b90   Object storage C          storage      last used 4h ago      │
│   0x2b18…9e04   Own operating wallet      internal     always allowed        │
│                                                                              │
│  BLOCKED CONTRACTS                                                           │
│   Unapproved DeFi protocols                            policy default        │
│   0xdead…beef   flagged by risk operators              added 2026-07-19      │
├──────────────────────────────────────────────────────────────────────────────┤
│  DECISION LOG, 24h                                     ( Full log )          │
│  ─────────────────────────────────────────────────────────────────────────── │
│  TIME      RECIPIENT       AMOUNT   CATEGORY   DECISION                      │
│  14:02:11  0xf120…88ab      42.00   compute    ✓ allowed                     │
│  12:44:07  0x77c1…6b90      18.40   storage    ✓ allowed                     │
│  11:31:55  0x5f19…c204     310.00   compute    ✕ rejected — not allowlisted  │
│  09:18:22  0xf120…88ab     280.00   compute    ⏱ queued — above 250 threshold│
│                                                  signed by 0x5d92 09:24      │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Today  14 allowed · 1 rejected · 1 required human approval                  │
├──────────────────────────────────────────────────────────────────────────────┤
│   ⓘ Policy changes take effect after a 24h delay while you have outstanding  │
│     debt. Every autonomous decision above is logged and auditable.           │
│                                            ( Discard )   [ Save policy ]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Payment, daily and approval limits | Agent Wallet policy | RT | BOR |
| Daily spend used | Agent Wallet counters | RT | BOR |
| Allowed categories | Policy | RT | BOR |
| Recipient allowlist and last use | Policy + transfer log | RT | BOR |
| Blocked contracts | Policy + protocol blocklist | RT | BOR/OPS |
| Decision log | Policy engine, PRD §31.3 | RT | BOR |
| Policy change delay | Protocol rule while debt > 0 | STATIC | PUB |

---

## 8.12 S-31 — Reserve and security bond

**Route** `/reserve` · **PRD** §10.6, §18.2

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Reserve and bond                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  BORROWER LOSS RESERVE                                                       │
│   Balance            248.60 USDC       Target      253.00 USDC               │
│   Coverage            98.3%            [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░]                │
│   Funded at 2% of settled revenue · ~9.00 USDC/day · target in 1 day         │
│                                                                              │
│   May be applied to: missed repayment · temporary revenue decline ·          │
│   refunds · protocol-defined borrower losses.                                │
│                                                                              │
│   Release  Available 30 days after outstanding debt reaches zero.            │
│            < Request release >   disabled — outstanding debt 2,008.42        │
├──────────────────────────────────────────────────────────────────────────────┤
│  SECURITY BOND                                                               │
│   Required for custody models B and C, and above tier thresholds.            │
│   Your custody model is A and your limit is below the bond threshold.        │
│   Posted    0.00 USDC        Required   0.00 USDC        ✓ not required      │
│                                                                              │
│   ⓘ Posting a voluntary bond raises your effective limit ceiling under the   │
│     custody cap. ( Model the effect )                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  RESERVE ACTIVITY                                                            │
│  DATE        EVENT                        AMOUNT      BALANCE     TX         │
│  Aug 01      contribution 2% of revenue     +9.00      248.60   ⧉ 0x4a71…    │
│  Jul 31      contribution 2% of revenue     +8.82      239.60   ⧉ 0x30bc…    │
│  Jul 18      applied to missed repayment   −12.40      118.22   ⧉ 0x8e02…    │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Lifetime contributed 261.00 · applied 12.40 · released 0.00                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Reserve balance, target, coverage | Router reserve accounting | EVT | BOR |
| Daily contribution rate | `reserveBps` × daily revenue | 10s | BOR |
| Release eligibility | PRD §16.7 conditions | RT | BOR |
| Bond posted and required | Custody model + tier thresholds | ASSESS | BOR/OPS |
| Reserve activity ledger | Reserve events | EVT | CHAIN |

---

## 8.13 S-32 — Watch and Restricted states

**Route** `/dashboard` variants · **PRD** §17.4–17.7

The dashboard chrome is unchanged; the banner and the action row change. All four variants below replace the S-20 action row.

**WATCH**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠  WATCH — Revenue declined 27% over 30 days                                 │
│    Credit limit reduced 2,530.00 → 1,770.00. Borrowing continues at the      │
│    reduced limit. Triggered 2026-08-02 03:00 UTC.                            │
│    Recovery: two consecutive assessments with growth above −10%.             │
│                                       ( What changed? )  ( Revenue detail )  │
└──────────────────────────────────────────────────────────────────────────────┘
      [ Borrow up to 0.00 ]   ( Repay manually )   ( Why this limit? )
       └ available credit is 0 while principal 2,000 exceeds the new limit
```

**RESTRICTED**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⛔ RESTRICTED — Manufactured revenue detected                                │
│    3 payer wallets contributing 2,400.00 USDC were funded by your own        │
│    operating wallet within 7 days of their first payment.                    │
│    Credit limit → 0.00 · new draws blocked · repayment share 20% → 35%       │
│    Outstanding 2,000.00 USDC continues repaying from routed revenue.         │
│                                          ( See evidence )  ( Dispute )       │
└──────────────────────────────────────────────────────────────────────────────┘
      < Borrow disabled >   [ Repay manually ]   ( See evidence )
```

**DELINQUENT**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⛔ DELINQUENT — Interest coverage below 1.0 for 7 days                       │
│    Reserve of 248.60 has been applied to accrued interest.                   │
│    Repayment share raised to 50%. Non-essential spending frozen.             │
│    Default in 14 days unless routed revenue resumes.                         │
│                                        ( Recovery options )  ( Contact ops ) │
└──────────────────────────────────────────────────────────────────────────────┘
```

**DEFAULTED**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⛔ DEFAULTED — No routed revenue for 21 days with outstanding principal      │
│    Recorded permanently in the public default registry on 2026-08-24.        │
│    Principal at default 2,000.00 · recovered so far 0.00                     │
│    A cure path is available. Defaults may be cured but never removed.        │
│                                                     [ Begin cure → S-33 ]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| State | `BorrowerAccount.status` | EVT | CHAIN |
| Trigger reason and evidence | Risk engine trigger record | EVT | BOR / code to PUB |
| Limit before / after | `RiskAssessment` | ASSESS | CHAIN |
| Escalated repayment share | `BorrowerAccount.repaymentBps` | EVT | CHAIN |
| Recovery condition | Protocol rule for the specific trigger | STATIC | BOR |
| Days to next escalation | Trigger timer | RT | BOR |

---

## 8.14 S-33 — Recovery and cure

**Route** `/recovery` · **PRD** §19.5, §18.3

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Cure                                                  ● DEFAULTED  │
├──────────────────────────────────────────────────────────────────────────────┤
│   Outstanding at default   2,000.00 USDC      Recovered   640.00 USDC        │
│   Remaining                1,360.00 USDC      Recovery      32.0%            │
│   [▓▓▓▓▓▓░░░░░░░░░░░░░░░░]                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│   CURE PROGRESS                                                              │
│   ✓ 1  Re-bind a Revenue Router            0x7f3a…c1d2  verified Aug 26      │
│   ✓ 2  Accept the recovery repayment share 50%                               │
│   ⏱ 3  Repay remaining principal and interest                                │
│         1,360.00 remaining · ~112.50/day at current revenue · ~12 days       │
│   ○ 4  30 days of continued routed revenue after full repayment              │
├──────────────────────────────────────────────────────────────────────────────┤
│   DURING CURE                                                                │
│   Credit limit                     0.00 USDC                                 │
│   Repayment share                    50%   (recovery rate)                   │
│   Reserve share                       0%   applied to debt instead           │
│   Operating share                    50%                                     │
│   Reliability probes                continuing                               │
│   Progress visibility               public — /reputation/0x9c4e…a7f1         │
│                                                                              │
│   AFTER CURE                                                                 │
│   Re-entry tier                  Restricted                                  │
│   Advance rate                   50% of tier base for 180 days               │
│   Default record                 remains visible with curedAt set            │
├──────────────────────────────────────────────────────────────────────────────┤
│   ( Propose a settlement )                        [ Repay 1,360.00 now ]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Principal at default, recovered, remaining | `DefaultRecord` | EVT | CHAIN |
| Cure step status | Cure state machine | EVT | BOR/PUB |
| Recovery repayment share | `BorrowerAccount.repaymentBps` | EVT | CHAIN |
| Days to full repayment | Remaining ÷ daily recovery rate | 10s | BOR |
| Post-cure terms | Protocol rule, PRD §19.5 | STATIC | PUB |

---

## 8.15 S-34 — Account closure

**Route** `/settings/close` · **PRD** §16.7

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Close account                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│   CLOSURE CONDITIONS                                                         │
│   ✓ Outstanding debt equals zero                        0.00 USDC            │
│   ✓ Pending repayments equal zero                       0.00 USDC            │
│   ✓ No active dispute                                   none open            │
│   ⏱ Reserve release period elapsed                      18 of 30 days        │
│                                                                              │
│   ON CLOSURE                                                                 │
│   Reserve returned to operating wallet                253.00 USDC            │
│   Security bond returned                                0.00 USDC            │
│   Revenue Router unbound — revenue routes 100% to you                        │
│                                                                              │
│   RETAINED AFTER CLOSURE                                                     │
│   Default registry records (none for this account)                           │
│   Aggregate repayment history for reputation attestations                    │
│   Audit records required by the retention policy                             │
│   Deleted: payer data, endpoint URL, revenue detail, KYB record              │
│                                                                              │
│   ⓘ Closing does not erase your reputation. Reopening with the same          │
│     endpoint and owner restores your history.                                │
│                                                                              │
│                              ( Cancel )     < Close account in 12 days >     │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Closure conditions | `CreditManager` + dispute store | RT | BOR |
| Reserve release countdown | Reserve release timer | RT | BOR |
| Amounts returned | Reserve and bond balances | RT | BOR |
| Retention and deletion list | PRD §21.7 data-handling rules | STATIC | PUB |

---
# 9. Liquidity-provider screens

## 9.1 S-40 — LP dashboard

**Route** `/vault` · **PRD** §29.5

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA    Vault  Portfolio  Performance                            ⌄ 0x8e11 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┬───────────────────────┬────────────────────────┐  │
│  │ YOUR POSITION         │ CURRENT VALUE         │ NET APY                │  │
│  │                       │                       │                        │  │
│  │  5,000.00 USDC        │  5,000.00 USDC        │   6.00%                │  │
│  │  4,962.31 shares      │  earned  0.00         │   3.08% organic        │  │
│  │  price  1.007597      │  since  Aug 01        │   2.92% subsidy        │  │
│  └───────────────────────┴───────────────────────┴────────────────────────┘  │
│                                                                              │
│  ⓘ 2.92% of the displayed yield is a protocol bootstrap subsidy funded from  │
│    the protocol reserve. It ends on 2026-10-30 or when the subsidy cap is    │
│    reached. Organic yield is 3.08%. Neither is guaranteed.                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  VAULT                                                                       │
│   Total vault assets                                  25,000.00 USDC         │
│   Available liquidity                                 16,530.00 USDC         │
│   Outstanding loans                                    8,470.00 USDC         │
│                                                                              │
│   Utilization  33.88%                                                        │
│   [▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]                          │
│    0%              33.9%          80% kink      85% cap        100%          │
│                                    │              │                          │
│                                    └ rate steepens└ draws blocked            │
│                                                                              │
│   Liquidity buffer      66.1%   floor 15%   ✓                                │
│   Withdrawal queue       0.00 USDC · 0 positions                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  RATES                                  │  PROTECTION                        │
│  Vault base rate         7.71%          │  First-loss tranche  2,500.00      │
│  Blended borrower rate  12.10%          │  coverage             10.0%   ✓    │
│  Protocol spread         3.00%          │  Protocol reserve      412.60      │
│  Your gross yield        4.10%          │  reserve coverage       4.9%   ✓   │
│  Your net organic        3.08%          │  Realized losses         0.00      │
│  Bootstrap subsidy       2.92%          │  Active borrowers           7      │
│  Displayed APY           6.00%          │  Borrowers on watch         1      │
├──────────────────────────────────────────┴───────────────────────────────────┤
│  LOAN BOOK BY TIER                       Revenue coverage of principal 4.9×  │
│   Prime        0.00      0.0%                                                │
│   Strong   4,120.00     48.6%   ████████████████████                         │
│   Standard 3,510.00     41.4%   █████████████████                            │
│   Watch      840.00      9.9%   ████                                         │
│   Restricted   0.00      0.0%                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│         [ Deposit USDC ]     ( Withdraw )     ( Portfolio )  ( Performance ) │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Shares held, share price, value | `CreditVault` ERC-4626 accounting | EVT | LP (own position) |
| Interest earned | Value − cost basis | EVT | LP |
| Displayed APY, organic, subsidy | Rate engine + subsidy ledger, PRD §23.7 | 10s | LP/PUB |
| Total assets, available, outstanding | `CreditVault` | EVT | PUB |
| Utilization and thresholds | PRD §15.1, §23.3 | EVT | PUB |
| Liquidity buffer | `CreditVault` | EVT | PUB |
| Withdrawal queue depth and count | Queue contract | EVT | LP |
| Base rate, blended rate, spread | Rate engine, PRD §15.2–15.3 | 10s | PUB |
| First-loss tranche and coverage | Tranche accounting, PRD §34.2 | EVT | LP/PUB |
| Protocol reserve and coverage | Reserve contract | EVT | LP/PUB |
| Realized losses | `recordLoss` sum | EVT | PUB |
| Borrower count, watch count | `CreditManager` | EVT | LP |
| Loan book by tier | Aggregated principal by tier | EVT | LP |
| Revenue coverage of principal | Portfolio routed revenue ÷ principal | 10s | LP |
| Any individual borrower's revenue | — | — | **NEVER** |

**Design note** — the subsidy disclosure is mandatory and cannot be collapsed. PRD §23.7 and §32 both prohibit presenting subsidized yield as organic.

---

## 9.2 S-41 — Deposit

**Route** `/vault/deposit` · **PRD** §22.6

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Deposit USDC                                                           [ ✕ ]│
├──────────────────────────────────────────────────────────────────────────────┤
│   Wallet balance   12,400.00 USDC                        0x8e11…4c73         │
│                                                                              │
│   Amount           [ 5,000.00                                      ] USDC    │
│                    ( 25% )  ( 50% )  ( 75% )  ( MAX )                        │
│                                                                              │
│   You receive      4,962.31 RIV-USDC shares  at 1.007597 per share           │
├──────────────────────────────────────────────────────────────────────────────┤
│   AFTER DEPOSIT                                                              │
│   Total vault assets       25,000.00 → 30,000.00 USDC                        │
│   Utilization                  33.88% → 28.23%                               │
│   Vault base rate               7.71% → 7.26%                                │
│   Your share of the vault           — → 16.67%                               │
│   Estimated net APY at 28.23% utilization        2.57% organic + subsidy     │
│                                                                              │
│   ⓘ Depositing lowers utilization, which lowers the rate for everyone.       │
│     Your yield estimate reflects the post-deposit rate, not the current one. │
├──────────────────────────────────────────────────────────────────────────────┤
│   WHAT YOU ARE UNDERWRITING                                                  │
│   ✓ Loans amortize continuously — ~2.2% of principal returns daily           │
│   ✓ Protocol first-loss tranche covers 10.0% of vault assets                 │
│   ✓ 15% liquidity buffer is enforced by the vault contract                   │
│   ⚠ Withdrawals above the buffer enter a FIFO queue funded by repayments     │
│   ⚠ Losses are socialized proportionally, including to queued positions      │
│   ⚠ Vault shares may be securities in your jurisdiction. Testnet only.       │
│                                                                              │
│   [x] I have read the risk disclosures and the withdrawal mechanics.         │
├──────────────────────────────────────────────────────────────────────────────┤
│                              ( Cancel )     [ Deposit 5,000.00 USDC ]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Wallet balance | Arc RPC | RT | LP |
| Share price and shares issued | `CreditVault.convertToShares` | RT | PUB |
| Post-deposit vault state | Simulation | RT | PUB |
| Post-deposit rate and APY | Rate engine simulation | RT | PUB |
| Daily amortization rate | PRD §23.2 | STATIC | PUB |
| First-loss coverage | Tranche accounting | EVT | PUB |
| Risk disclosures | Static, from PRD §23 and §32 | STATIC | PUB |

---

## 9.3 S-42 — Withdraw and queue

**Route** `/vault/withdraw` · **PRD** §23.4, §23.5

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Withdraw                                                               [ ✕ ]│
├──────────────────────────────────────────────────────────────────────────────┤
│   Your position    5,000.00 USDC · 4,962.31 shares                           │
│                                                                              │
│   Amount           [ 5,000.00                                      ] USDC    │
│                    ( 25% )  ( 50% )  ( MAX 5,000.00 )                        │
├──────────────────────────────────────────────────────────────────────────────┤
│   HOW THIS WILL BE SERVED                                                    │
│                                                                              │
│   Available now         16,530.00 − 3,750.00 buffer  =  12,780.00 USDC       │
│   Your request                                          5,000.00 USDC        │
│                                                                              │
│   ✓ Served immediately in full. No queue.                                    │
│                                                                              │
│   Withdrawal fee at 33.88% utilization                     0.00 USDC  (0.00%)│
│   └─ Fee applies only above 80% utilization, rising linearly to 1.00% at     │
│      95%. It is paid to remaining liquidity providers.                       │
│                                                                              │
│   You receive                                           5,000.00 USDC        │
├──────────────────────────────────────────────────────────────────────────────┤
│                              ( Cancel )     [ Withdraw 5,000.00 USDC ]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Queued variant** — shown when the request exceeds available liquidity minus the buffer.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│   HOW THIS WILL BE SERVED                                                    │
│                                                                              │
│   Available now         16,530.00 − 3,750.00 buffer  =  12,780.00 USDC       │
│   Your request                                         18,000.00 USDC        │
│                                                                              │
│   ⏱ Partially queued                                                         │
│     Immediate                                          12,780.00 USDC        │
│     Queued                                              5,220.00 USDC        │
│                                                                              │
│   QUEUE                                                                      │
│   Positions ahead of you              2  ·  3,410.00 USDC                    │
│   Your position                       #3                                     │
│   Funded from repayments at ~186.34 USDC/day (trailing 7-day rate)           │
│   Queued withdrawals are funded before any new borrower draw is approved.    │
│   Estimated full availability         2026-08-25   (~46 days)                │
│                                                                              │
│   ⚠ Queued shares stop accruing interest at the moment of queue entry.       │
│   ⚠ Queued positions still bear their proportional share of any loss         │
│     realized before the claim is made. Queueing does not escape a loss.      │
│   ✓ You may cancel at any time before claiming. Shares and accrual resume.   │
├──────────────────────────────────────────────────────────────────────────────┤
│                    ( Cancel )     [ Withdraw 12,780 and queue 5,220 ]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Queue status view** — persistent card on S-40 once a position exists.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  WITHDRAWAL QUEUE — position #3                                              │
│   Requested   5,220.00 USDC        Funded so far   1,864.20 USDC   35.7%     │
│   [▓▓▓▓▓▓▓░░░░░░░░░░░░]                                                      │
│   Requested 2026-08-02 · epoch 214 · estimated completion 2026-08-25         │
│              [ Claim 1,864.20 now ]        ( Cancel remainder )              │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Position value and shares | `CreditVault` | EVT | LP |
| Available liquidity, buffer floor | `CreditVault` | RT | PUB |
| Immediate vs. queued split | Queue simulation | RT | LP |
| Withdrawal fee | PRD §23.5 curve | RT | PUB |
| Positions ahead, own position | Queue contract | EVT | LP |
| Trailing repayment rate | 7-day repayment mean | 10s | LP |
| Estimated availability | Queued amount ÷ repayment rate | 10s | LP |
| Funded so far, epoch | Queue contract | EVT | LP |
| Accrual-stop and loss-bearing rules | PRD §23.4, §23.6 | STATIC | PUB |

---

## 9.4 S-43 — Portfolio composition

**Route** `/vault/portfolio` · **PRD** §21.5

The privacy boundary made visible: composition and performance, never obligor detail.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Portfolio composition                          As of 2026-08-02    │
├──────────────────────────────────────────────────────────────────────────────┤
│  BY TIER                                │  BY CUSTODY MODEL                  │
│   Prime        0.00     0.0%            │   A structural  7,630.00   90.1%   │
│   Strong   4,120.00    48.6% ████████   │   B policy        840.00    9.9%   │
│   Standard 3,510.00    41.4% ███████    │   C sweep           0.00    0.0%   │
│   Watch      840.00     9.9% ██         │                                    │
│   Restricted   0.00     0.0%            │   Weighted enforceability  0.95    │
├─────────────────────────────────────────┴────────────────────────────────────┤
│  BY SECTOR                                                                   │
│   Data lookup and static datasets       3,940.00    46.5%  ████████████      │
│   Text generation and inference proxy   2,180.00    25.7%  ███████           │
│   Search, retrieval and enrichment      1,510.00    17.8%  █████             │
│   Document and media processing           840.00     9.9%  ███               │
│                                                                              │
│   Sector exposure cap  40% ─ ⚠ data lookup at 46.5%, above cap               │
│   New draws in this sector are blocked until exposure falls below 40%.       │
├──────────────────────────────────────────────────────────────────────────────┤
│  BY BORROWER SIZE BAND                   │  UPSTREAM DEPENDENCY              │
│   Under 1,000        2 borrowers  9.9%   │   Model provider A       58.2% ⚠  │
│   1,000 – 2,500      3 borrowers 31.1%   │   GPU marketplace B      21.4%    │
│   2,500 – 5,000      2 borrowers 59.0%   │   Object storage C       12.9%    │
│   Over 5,000         0 borrowers  0.0%   │   Other                   7.5%    │
│                                          │                                   │
│   Largest single borrower  2,400.00      │   ⚠ A shock at provider A would   │
│   9.6% of vault  ⚠ above the 5% cap      │     impair 58% of the book.       │
│   → that borrower's limit is frozen      │     Diversifying across borrowers │
│                                          │     does not diversify this.      │
├──────────────────────────────────────────┴───────────────────────────────────┤
│  PORTFOLIO REVENUE COVERAGE                                                  │
│   Aggregate routed revenue, 30d           41,280.00 USDC                     │
│   Outstanding principal                    8,470.00 USDC                     │
│   Coverage multiple                              4.9×                        │
│   Weighted mean projected payback              26 days                       │
│                                                                              │
│   Individual borrower revenue is not disclosed. Coverage is reported at      │
│   portfolio level only.                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Principal by tier, custody model, sector | Aggregated `CreditManager` state | EVT | LP |
| Weighted enforceability | Custody multipliers weighted by principal | EVT | LP |
| Sector exposure cap and breach | Protocol parameter + aggregation | EVT | LP |
| Borrower size bands | Aggregated, banded, never named | EVT | LP |
| Largest single borrower share | Aggregated | EVT | LP |
| Upstream dependency mix | Declared upstreams weighted by principal | ASSESS | LP |
| Aggregate routed revenue | Sum of router inflows across borrowers | 10s | LP |
| Coverage multiple, mean payback | Derived | 10s | LP |
| Borrower identity or per-borrower revenue | — | — | **NEVER** |

---

## 9.5 S-44 — Performance and losses

**Route** `/vault/performance` · **PRD** §23.6, §38

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Vault performance                     Period [ Since inception ▾ ] │
├──────────────────────────────────────────────────────────────────────────────┤
│  SHARE PRICE                                                                 │
│  1.010 ┤                                              ▁▁▁▁▁▔▔ 1.007597       │
│  1.005 ┤                          ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔                       │
│  1.000 ┼▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                                           │
│        Jun 01                                                 Aug 02         │
│        ⓘ No loss event has occurred. A realized loss appears as a step down. │
├──────────────────────────────────────────────────────────────────────────────┤
│  RETURNS                                │  CREDIT PERFORMANCE                │
│  Interest generated      184.20 USDC    │  Principal originated  14,660.00   │
│  Protocol spread taken    45.60 USDC    │  Principal repaid       6,190.00   │
│  Subsidy paid in          62.10 USDC    │  Outstanding            8,470.00   │
│  Net to LPs              200.70 USDC    │  Repayment rate            100.0%  │
│                                         │  Delinquency rate            0.0%  │
│  Organic APY               3.08%        │  Default rate                0.0%  │
│  Displayed APY             6.00%        │  Realized losses             0.00  │
│  Since inception          +0.76%        │  Loss-reserve coverage       4.9%  │
├─────────────────────────────────────────┴────────────────────────────────────┤
│  UTILIZATION AND RATE                                                        │
│   80% ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  kink                │
│   60% ┤                                                                      │
│   40% ┤                            ▁▁▁▁▁▁▔▔▔▔▔▔▔▁▁▁▁ 33.9%                   │
│   20% ┤        ▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔                                          │
│    0% ┼▔▔▔▔▔▔▔▔                                                              │
│       Jun 01                                              Aug 02             │
├──────────────────────────────────────────────────────────────────────────────┤
│  LOSS HISTORY                                                                │
│   No losses realized.                                                        │
│                                                                              │
│   When a loss occurs it is applied in this order:                            │
│     1  Borrower loss reserve                                                 │
│     2  Protocol first-loss tranche        2,500.00 available                 │
│     3  Protocol loss reserve                412.60 available                 │
│     4  Liquidity-provider shares          socialized proportionally          │
│                                                                              │
│   Cohort-1 liquidity providers are protected by the first-loss tranche       │
│   until cohort-1 borrowers complete 3 repayment cycles each.                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Share price series | `CreditVault` share price snapshots | EVT | PUB |
| Interest generated, spread, subsidy, net | Vault accounting + subsidy ledger | EVT | LP |
| Organic and displayed APY | Rate engine | 10s | LP/PUB |
| Principal originated, repaid, outstanding | `CreditManager` cumulative | EVT | PUB |
| Repayment, delinquency, default rates | Derived, PRD §38 | EVT | PUB |
| Realized losses and history | `recordLoss` events | EVT | PUB |
| Loss-reserve coverage | Reserve ÷ outstanding principal | EVT | LP/PUB |
| Utilization series | Snapshots | EVT | PUB |
| Loss waterfall and tranche balances | PRD §18.2, §34.2 | EVT | LP/PUB |

---
# 10. Risk operator screens

Separate authentication, access-logged, exact values rather than bands. Every view on this surface writes an access record per PRD §31.4.

## 10.1 S-50 — Risk console overview

**Route** `/risk` · **PRD** §29.6

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA RISK    Overview  Watchlist  Anomalies  Exposure  Params   ops@ ⌄    │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⛔ 1 CRITICAL   ⚠ 3 WARNING   ⓘ 2 INFO                    Auto-refresh 10s  │
├──────────────────────────────────────────────────────────────────────────────┤
│  ALERTS                                                                      │
│  ⛔ 0x9c4e…a7f1  Circular funding detected — 3 payers, 2,400.00 USDC         │
│                  14:31 UTC · auto-restricted · principal at risk 2,000.00    │
│                                                     [ Investigate → S-53 ]   │
│  ⚠ 0x4c30…f18b  Coverage ratio 0.71 — probable partial diversion             │
│                  09:22 UTC · WATCH · principal 840.00     [ Review → S-52 ]  │
│  ⚠ Sector       Data lookup exposure 46.5%, cap 40%                          │
│                  new draws in sector blocked            [ Exposure → S-54 ]  │
│  ⚠ Borrower     0x1f88…20ce at 9.6% of vault, cap 5%                         │
│                  limit frozen                             [ Review → S-52 ]  │
│  ⓘ 0x77b2…4419  Assessment overdue by 4h — indexer lag                       │
│  ⓘ Upstream     Model provider A now 58.2% of declared cost base             │
├──────────────────────────────────────────────────────────────────────────────┤
│  PORTFOLIO                              │  PROTOCOL HEALTH                   │
│  Outstanding        8,470.00 USDC       │  Vault utilization       33.88% ✓  │
│  Borrowers                    7         │  Liquidity buffer        66.1%  ✓  │
│  On watch                     1         │  Withdrawal queue         0.00  ✓  │
│  Restricted                   1         │  Reserve coverage         4.9%  ✓  │
│  Delinquent                   0         │  First-loss coverage     10.0%  ✓  │
│  Defaulted (cumulative)       2         │  Indexer lag              1.4s  ✓  │
│  Mean score                  71         │  Probe success 24h      99.6%  ✓   │
│  Weighted default prob.    2.1%         │  Assessment queue            0  ✓  │
├─────────────────────────────────────────┴────────────────────────────────────┤
│  PENDING LIMIT RECOMMENDATIONS                                               │
│  BORROWER      CURRENT    RECOMMENDED   Δ         BINDING        ACTION      │
│  0x1f88…20ce   2,400.00      2,400.00   —      exposure cap   ( Review )     │
│  0x77b2…4419   1,120.00      1,480.00  +360    quality        [ Approve ]    │
│  0x3ea0…7c15     620.00        410.00  −210    growth −22%    [ Approve ]    │
├──────────────────────────────────────────────────────────────────────────────┤
│         < Pause lending >   < Emergency debt freeze >   ( Parameters )       │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Alert queue with severity | Risk engine trigger stream | RT | OPS |
| Portfolio counts by status | `CreditManager` | EVT | OPS |
| Mean score, weighted default probability | Risk engine | 10s | OPS |
| Vault health metrics | `CreditVault` + queue | 10s | OPS |
| Indexer lag | Indexer heartbeat vs. chain head | RT | OPS |
| Probe success rate | Probe scheduler | 10s | OPS |
| Assessment queue depth | Orchestrator | RT | OPS |
| Pending recommendations | `RiskRegistry` unapplied assessments | RT | OPS |

**Actions** — Pause lending and emergency debt freeze both require operator quorum and render a confirmation with the exact effect on each borrower.

---

## 10.2 S-51 — Watchlist

**Route** `/risk/watch` · **PRD** §22.7

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA RISK · Watchlist              Sort [ Principal at risk ▾ ]  7 shown  │
├──────────────────────────────────────────────────────────────────────────────┤
│  BORROWER     STATUS      SCORE  PRINCIPAL  COV   INT.COV  TRIGGER           │
│  ─────────────────────────────────────────────────────────────────────────── │
│  0x9c4e…a7f1 ⛔RESTRICTED  57▼21  2,000.00  0.98    104.2  circular funding  │
│  0x1f88…20ce ●ACTIVE       81     2,400.00  0.99     88.1  exposure cap      │
│  0x4c30…f18b ⚠WATCH        62▼9     840.00  0.71     41.6  coverage < 0.80   │
│  0x77b2…4419 ●ACTIVE       74     1,120.00  0.96     62.3  assessment late   │
│  0x3ea0…7c15 ⚠WATCH        58▼14    620.00  0.94     22.8  growth −22%       │
│  0x2d51…8e77 ●ACTIVE       88     1,490.00  1.00    118.4  —                 │
│  0x6b09…f3a2 ●ACTIVE       76         0.00  0.97        —  —                 │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Principal at risk (WATCH + RESTRICTED)        3,460.00 USDC   40.9% of book │
│  Covered by reserves + first loss              3,161.20 USDC   91.4%         │
├──────────────────────────────────────────────────────────────────────────────┤
│  Bulk actions   ( Reassess selected )  ( Freeze draws )  ( Notify borrowers )│
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Status, score and delta | `CreditManager`, `RiskRegistry` | 10s | OPS |
| Principal | `BorrowerAccount` | RT | OPS |
| Coverage ratio | PRD §11.5 | 10s | OPS |
| Interest coverage | PRD §15.5 | 10s | OPS |
| Active trigger | Risk engine | RT | OPS |
| Principal at risk and reserve coverage | Aggregated | 10s | OPS |

---

## 10.3 S-52 — Borrower risk detail

**Route** `/risk/borrower/:id` · **PRD** §22.7

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA RISK · 0x9c4e…a7f1   QuoteStream Market Data API      ⛔ RESTRICTED  │
│  Operator QuoteStream Labs Ltd · Singapore · KYB verified 2026-06-05         │
├──────────────────────────────────────────────────────────────────────────────┤
│  POSITION                               │  EXACT FACTORS (post-detection)    │
│  Principal          2,000.00 USDC       │  S  reliability          0.9270    │
│  Accrued interest       8.42 USDC       │  C  concentration        0.8100    │
│  Limit                  0.00 USDC       │  V  volatility           0.8800    │
│  Reserve              248.60 USDC       │  D  diversity            0.7900    │
│  Bond                   0.00 USDC       │  M  operating capacity   0.8800    │
│  Repayment share          35%           │  G  growth               1.0000    │
│  Rate                  10.71%           │  Q                       0.8464    │
│  Days since draw            4           │  HHI                     0.1900    │
├─────────────────────────────────────────┴────────────────────────────────────┤
│  SCORE COMPONENTS                    WEIGHT   VALUE   CONTRIB   Δ 24h        │
│   Service reliability                  20%    0.927    18.54    +0.4         │
│   Revenue consistency                  18%    0.880    15.84    −0.5         │
│   Repayment history                    15%    1.000    15.00     0.0         │
│   Customer concentration               13%    0.810    10.53    −1.7         │
│   Customer diversity                   10%    0.790     7.90    −2.1         │
│   Revenue custody strength              8%    1.000     8.00     0.0         │
│   Operating history                     6%    0.330     1.98     0.0         │
│   Revenue growth                        5%    0.500     2.50    −4.2         │
│   Reserve coverage                      5%    0.983     4.92    +0.1         │
│                                              ──────────────────────────      │
│   Risk score                                            57      −21          │
├──────────────────────────────────────────────────────────────────────────────┤
│  TIMELINE                                                                    │
│  14:31  ⛔ Auto-restricted — circular funding, 3 payers, 2,400.00            │
│  14:31  Repayment share 20% → 35%                                            │
│  14:30  Assessment #3 — score 78 → 57, limit 2,530 → 0                       │
│  12:47  Assessment #2 — score 68 → 78, limit 1,690 → 2,530                   │
│  12:52  Draw 800.00 USDC → 0x2b18…9e04                                       │
│  Jul 03 Assessment #1 — limit 0 → 1,690                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  ACTIONS                                                                     │
│  ( Force reassessment )  ( Adjust repayment share )  ( Add note )            │
│  < Restrict >  < Escalate to delinquent >  < Declare default → S-56 >        │
│  ( Resolve dispute )  ( Release restriction )                                │
│                                                                              │
│  ⓘ Every action here is access-logged with operator identity and reason.     │
│    Restriction release requires a second operator signature.                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Legal operator and KYB | KYB store, access-logged | STATIC | OPS |
| Exact factor values | Underwriting engine | ASSESS | OPS |
| Score component contributions | Score engine, PRD §14.3 | ASSESS | OPS |
| 24h component deltas | Score history | 10s | OPS |
| Timeline | Merged event stream | RT | OPS |
| Operator actions and audit trail | Admin action log | RT | OPS |

---

## 10.4 S-53 — Anomaly detail

**Route** `/risk/anomaly/:id` · **PRD** §20.1, §20.2

The screen behind the demo's manipulation catch.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA RISK · Anomaly A-0142        CIRCULAR FUNDING        ⛔ CONFIRMED    │
│  Borrower 0x9c4e…a7f1 · detected 2026-08-02 14:31:07 UTC                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  FINDING                                                                     │
│  3 payer wallets contributing 2,400.00 USDC over 9 days were first funded    │
│  by the borrower's own operating wallet within 7 days of their first         │
│  payment. Funding graph shows a closed loop.                                 │
│                                                                              │
│  FUNDING GRAPH                                                               │
│                       0x2b18…9e04  operating wallet                          │
│                             │                                                │
│              ┌──────────────┼──────────────┐                                 │
│              ▼              ▼              ▼                                 │
│        0x31aa…7c02   0x88f0…12de    0x5c19…9b41                              │
│        funded Jul 22 funded Jul 23  funded Jul 24                            │
│          120.00        150.00         140.00                                 │
│              │              │              │                                 │
│              └──────────────┼──────────────┘                                 │
│                             ▼                                                │
│                       0x7f3a…c1d2  revenue router                            │
│                       2,400.00 in 214 payments                               │
│                             │                                                │
│                             └──────► 78% ──────► 0x2b18…9e04                 │
│                                                                              │
│  Loop closed. Net economic revenue from these payers: −68.00 USDC            │
│  after routing costs. The borrower paid itself at a loss.                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  EVIDENCE                                                                    │
│  SIGNAL                          VALUE          THRESHOLD    RESULT          │
│  Common funding source               3 of 3      any         ✕ fail          │
│  Payer age at first payment      1.2 d mean      ≥ 7 d       ✕ fail          │
│  Payment-pattern similarity           0.97       ≤ 0.85      ✕ fail          │
│  Inter-payment interval variance      0.03       ≥ 0.20      ✕ fail          │
│  Circular flow detected                yes       none        ✕ fail          │
│  Net economic revenue              −68.00        > 0         ✕ fail          │
│  Independent-entity confidence         0.02      ≥ 0.60      ✕ fail          │
├──────────────────────────────────────────────────────────────────────────────┤
│  IMPACT                                                                      │
│                          BEFORE        AFTER         Δ                       │
│  Eligible revenue 30d   13,500.00    11,100.00   −2,400.00                   │
│  Largest payer share          14%          19%        +5pp                   │
│  Revenue diversity D        0.950        0.790       −0.160                  │
│  Concentration C            0.860        0.810       −0.050                  │
│  Risk score                    78           57          −21                  │
│  Tier                      Strong   Restricted            —                  │
│  Credit limit            2,530.00         0.00   −2,530.00                   │
│  Repayment share             20%           35%       +15pp                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  AUTOMATED RESPONSE                                     applied 14:31:09     │
│  ✓ 2,400.00 excluded from eligible revenue                                   │
│  ✓ Credit limit reduced to 0.00                                              │
│  ✓ New draws blocked                                                         │
│  ✓ Repayment share raised to 35%                                             │
│  ✓ Borrower notified                                                         │
│  ✓ Evidence hash 0x8b41…c07e written onchain     ⧉ 0x0d31…44a9               │
├──────────────────────────────────────────────────────────────────────────────┤
│  ( Add note )  ( Mark false positive )  < Escalate to default → S-56 >       │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Finding narrative | Generated from the evidence table | EVT | OPS |
| Funding graph | Indexer funding-source analysis | EVT | OPS |
| Each evidence signal and threshold | Anomaly detector, PRD §20.1–20.2 | EVT | OPS |
| Net economic revenue | Revenue minus routing and incentive costs | EVT | OPS |
| Before / after impact | Underwriting engine re-run | EVT | OPS |
| Automated response log | Risk engine action log | EVT | OPS/CHAIN |
| Evidence hash | Written to `RiskRegistry` | EVT | CHAIN |

**Design note** — marking a false positive restores the excluded revenue and triggers reassessment, and is itself recorded with operator identity. The evidence table is the artifact a disputing borrower sees, so every threshold is shown alongside its observed value rather than only the verdict.

---

## 10.5 S-54 — Exposure and concentration

**Route** `/risk/exposure` · **PRD** §23.8, §31.5

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA RISK · Exposure                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  LIMIT                          CURRENT    CAP      HEADROOM    STATUS       │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Vault utilization               33.88%   85.00%     51.12pp    ✓            │
│  Liquidity buffer                66.12%   15.00%     51.12pp    ✓            │
│  Per-borrower exposure            9.60%    5.00%     −4.60pp    ⛔ breached  │
│    └ 0x1f88…20ce  2,400.00 — limit frozen                                    │
│  Per-sector exposure             46.50%   40.00%     −6.50pp    ⛔ breached  │
│    └ Data lookup — new draws in sector blocked                               │
│  Customer-concentration cap      19.00%   40.00%     21.00pp    ✓            │
│  New-borrower aggregate           0.00%   20.00%     20.00pp    ✓            │
│  Credit-growth cap, 30d          18.20%   50.00%     31.80pp    ✓            │
│  Withdrawal-queue depth           0.00%   20.00%     20.00pp    ✓            │
│  Minimum reserve coverage         4.90%    3.00%      1.90pp    ✓            │
│  Realized losses, 30d             0.00%    2.00%      2.00pp    ✓            │
├──────────────────────────────────────────────────────────────────────────────┤
│  UPSTREAM CORRELATED EXPOSURE                                                │
│   Model provider A     4,930.00   58.2%  ████████████████  ⚠ above 40%       │
│   GPU marketplace B    1,812.00   21.4%  ██████                              │
│   Object storage C     1,092.00   12.9%  ███                                 │
│   Other                  636.00    7.5%  ██                                  │
│                                                                              │
│   ⚠ A price or availability shock at provider A impairs 58.2% of the book    │
│     simultaneously. Borrower diversification does not reduce this. Consider  │
│     a portfolio-level haircut or a sector draw freeze.                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  STRESS TEST                            Scenario [ −30% revenue, all ▾ ]     │
│   Weighted payback           26 d  →  37 d      ✓ within 90-day stress limit │
│   Borrowers below coverage 1.0    0  →   0      ✓                            │
│   Borrowers moved to WATCH        1  →   4      ⚠                            │
│   Projected 90-day losses      0.00  →  180.40  ✓ absorbed by first loss     │
│   Queue clearance time         0 d  →  12 d     ✓                            │
├──────────────────────────────────────────────────────────────────────────────┤
│   ( Freeze sector draws )  ( Adjust caps → S-55 )  ( Export stress report )  │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Each cap, current value, headroom | Protocol parameters + live aggregation | 10s | OPS |
| Breach flags and auto-actions taken | Risk engine | RT | OPS |
| Upstream exposure mix | Declared upstreams × principal | ASSESS | OPS |
| Stress-test outputs | Scenario engine, PRD §13.4 stressed horizon | on run | OPS |

---

## 10.6 S-55 — Parameters and emergency controls

**Route** `/risk/params` · **PRD** §31.1, §31.5

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA RISK · Protocol parameters                    ⚠ Quorum 2 of 3        │
├──────────────────────────────────────────────────────────────────────────────┤
│  UNDERWRITING                    CURRENT   PROPOSED   DELAY    EFFECT        │
│  Base repayment share               20%    [ 20% ]     24h    ⚠ recomputes   │
│                                                                 all advance  │
│                                                                 rates        │
│  Max horizon — Standard          45 d      [ 45 ]      24h                   │
│  Max horizon — Strong/Prime      60 d      [ 60 ]      24h                   │
│  Q floor (Q_min)                  0.35     [ 0.35 ]    24h                   │
│  Per-assessment growth cap        1.50     [ 1.50 ]    24h                   │
│  New-borrower cap             2,500.00     [ 2500 ]    24h                   │
│  Revenue seasoning delay           3 d     [ 3 ]       24h                   │
│                                                                              │
│  ⚠ The advance-rate table is derived from the repayment share and the        │
│    horizon. Changing either without recomputing the tier table causes the    │
│    horizon constraint to bind silently on every borrower.  ( Recompute )     │
├──────────────────────────────────────────────────────────────────────────────┤
│  RATE MODEL                      CURRENT   PROPOSED                          │
│  Base rate r₀                       5.0%   [ 5.0 ]                           │
│  Kink U_k                          80.0%   [ 80.0 ]                          │
│  Low slope s₁                       8.0%   [ 8.0 ]                           │
│  High slope s₂                     80.0%   [ 80.0 ]                          │
│  Premiums  Prime/Strong/Std/Restr   1/3/6/12%                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  VAULT                           CURRENT   PROPOSED                          │
│  Liquidity buffer floor            15.0%   [ 15.0 ]   ⓘ raise: immediate,    │
│  Max utilization                   85.0%   [ 85.0 ]     lower: 24h delay     │
│  Withdrawal fee at 95%              1.0%   [ 1.0 ]                           │
│  Bootstrap yield floor              6.0%   [ 6.0 ]     ends 2026-10-30       │
├──────────────────────────────────────────────────────────────────────────────┤
│  EMERGENCY                                                                   │
│  < Pause new draws >          effect: 7 borrowers cannot draw                │
│  < Pause deposits >           effect: vault closed to new liquidity          │
│  < Pause lending entirely >   effect: draws + deposits + assessments halted  │
│  < Emergency debt freeze >    effect: interest accrual stops protocol-wide   │
│                                                                              │
│  All emergency actions require 2 of 3 operator signatures and publish a      │
│  reason string onchain. Upgrades are subject to the governance delay.        │
├──────────────────────────────────────────────────────────────────────────────┤
│  SIGNATURES  ops-a ✓ 14:32   ops-b ○ pending   ops-c ○ pending               │
│                                          ( Discard )   [ Submit proposal ]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| All parameters, current and proposed | Governance contract | EVT | OPS/PUB |
| Change delay per parameter | Governance rules | STATIC | PUB |
| Derived-parameter warning | PRD §14.4 coupling rule | RT | OPS |
| Emergency action impact preview | Simulation across borrowers | RT | OPS |
| Signature quorum state | Multisig | RT | OPS |

---

## 10.7 S-56 — Default declaration

**Route** `/risk/default/:id` · **PRD** §19.8

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA RISK · Declare default          Borrower 0xaa71…0d3c                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  AUTOMATIC TRIGGERS                                       STATUS             │
│  Coverage ratio below 0.50 for 14 days      0.31 · 16 d   ✓ FIRED            │
│  Endpoint binding broken, uncured 7 days    broken · 12 d  ✓ FIRED           │
│  Interest coverage below 1.0 for 7 days     0.4 · 9 d      ✓ FIRED           │
│  No routed revenue for 21 days              18 d           ○ not yet         │
│                                                                              │
│  ⓘ Three automatic triggers have fired. Default is declared by the contract  │
│    and does not require operator action. This screen records the operator    │
│    review and the evidence bundle.                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  OPERATOR DECLARATION            required only for non-automatic grounds     │
│  Grounds   ( ) Confirmed fraudulent revenue                                  │
│            ( ) Confirmed wallet-policy violation                             │
│            ( ) Confirmed identity misrepresentation                          │
│  Evidence  [ ipfs://… or evidence hash                                    ]  │
│  Reason    [                                                              ]  │
├──────────────────────────────────────────────────────────────────────────────┤
│  DEFAULT WATERFALL PREVIEW                                                   │
│  Outstanding principal                                 4,200.00 USDC         │
│  Accrued interest                                         38.10 USDC         │
│                                                                              │
│  1  Accrued borrower repayments in flight                112.40  → 4,125.70  │
│  2  Borrower loss reserve                                284.00  → 3,841.70  │
│  3  Borrower security bond                               840.00  → 3,001.70  │
│  4  Protocol first-loss tranche                        2,500.00  →   501.70  │
│  5  Protocol loss reserve                                412.60  →    89.10  │
│  6  Liquidity-provider loss (socialized)                  89.10  →     0.00  │
│                                                                              │
│  LP impact   share price 1.007597 → 1.004008   −0.36%                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  ON DECLARATION                                                              │
│  ✓ Permanent record written to the public default registry                   │
│  ✓ Cure path opened — record may be cured but never removed                  │
│  ✓ Borrower notified with cure terms                                         │
│  ✓ Reputation attestation updated                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  SIGNATURES  ops-a ✓   ops-b ○   ops-c ○                                     │
│                              ( Cancel )     < Declare default >              │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Automatic trigger states and elapsed time | Trigger engine | RT | OPS |
| Declaration grounds and evidence | Operator input | on submit | CHAIN (hash) |
| Waterfall preview by layer | PRD §18.2 waterfall simulation | RT | OPS |
| LP share-price impact | Loss socialization simulation | RT | OPS/LP |
| Quorum state | Multisig | RT | OPS |

---

# 11. Partner screens

## 11.1 S-60 — Partner console

**Route** `/partner` · **PRD** §28.2, §28.3

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA PARTNER    Console  Sandbox  Keys  Usage        AgentMarket Inc ⌄    │
├──────────────────────────────────────────────────────────────────────────────┤
│  PRODUCTS                                                                    │
│  ● Score API                 active    since 2026-07-01                      │
│  ○ Router as a service       not enabled                ( Request )          │
│  ○ Delegated credit pool     not enabled                ( Request )          │
├──────────────────────────────────────────────────────────────────────────────┤
│  USAGE, 30 DAYS                         │  KEYS                              │
│  Score requests           14,210        │  pk_live_8f2…  prod   ● active     │
│  Unique subjects           1,884        │  pk_test_31a…  sandbox ● active    │
│  Mean latency              212ms        │                    ( + New key )   │
│  Rate limit          200 / minute       │  Scopes  score:read                │
│  Errors                    0.04%        │          reputation:read           │
│  Billable                14,210         │  IP allowlist  3 entries           │
├─────────────────────────────────────────┴────────────────────────────────────┤
│  MODEL VERSIONS                                                              │
│  Pinned version     riv-uw-2.1        your decisions remain reproducible     │
│  Latest available   riv-uw-2.1                                               │
│  Upgrade policy     [ Manual — notify me 30 days before deprecation      ▾ ] │
├──────────────────────────────────────────────────────────────────────────────┤
│  SCORE DISTRIBUTION OF YOUR SUBJECTS                                         │
│   Prime       ██                          4.2%   79 subjects                 │
│   Strong      ███████████               22.8%   429                          │
│   Standard    ████████████████████      41.1%   774                          │
│   Restricted  ███████████               22.4%   422                          │
│   Ineligible  ████                       9.5%   180                          │
│                                                                              │
│   ⓘ Subject-level detail is not available through this console. You receive  │
│     bands and scores per query, never the underlying revenue data.           │
├──────────────────────────────────────────────────────────────────────────────┤
│  EXPOSURE (delegated pools)                                                  │
│  Not enabled. A delegated pool requires you to fund a first-loss tranche     │
│  and is available after Rivora's own book has two quarters of loss data.     │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Enabled products | Partner record | STATIC | Partner |
| Request volume, unique subjects, latency, errors | API gateway metrics | 10s | Partner |
| Rate limit and scopes | Partner API key config | STATIC | Partner |
| Pinned and latest model version | Model registry, PRD §28.3 | EVT | Partner |
| Score distribution of queried subjects | Aggregated over the partner's own queries | 10s | Partner |
| Underlying borrower data | — | — | **NEVER** |

---

## 11.2 S-61 — Score API sandbox

**Route** `/partner/sandbox` · **PRD** §28.2, §28.3

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA PARTNER · Sandbox                          Synthetic borrowers only  │
├──────────────────────────────────────────────────────────────────────────────┤
│  REQUEST                                          [ Send ]  ( Copy as cURL ) │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ POST /v1/underwriting/score                                          │    │
│  │ {                                                                    │    │
│  │   "endpoint":      "https://sandbox.rivora.dev/synthetic/07",        │    │
│  │   "routerAddress": "0x7f3a…c1d2",                                    │    │
│  │   "window":        30                                                │    │
│  │ }                                                                    │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  RESPONSE                                            212ms · 200 OK          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ {                                                                    │    │
│  │   "score":             74,                                           │    │
│  │   "tier":              "Standard",                                   │    │
│  │   "recommendedLimit":  "4200.00",                                    │    │
│  │   "maxAdvanceRate":    0.20,                                         │    │
│  │   "maxHorizonDays":    45,                                           │    │
│  │   "reliabilityBand":   "HIGH",                                       │    │
│  │   "concentrationBand": "ELEVATED",                                   │    │
│  │   "custodyModel":      "A",                                          │    │
│  │   "confidence":        0.81,                                         │    │
│  │   "modelVersion":      "riv-uw-2.1",                                 │    │
│  │   "evidenceHash":      "0x2f81…7cd0",                                │    │
│  │   "validUntil":        "2026-08-03T14:00:00Z",                       │    │
│  │   "signature":         "0x8f21…03bd"                                 │    │
│  │ }                                                                    │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ✓ Signature verified against published signer key 0xA9…                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  SYNTHETIC BORROWERS                                                         │
│   /synthetic/01  Prime, low concentration, custody A                         │
│   /synthetic/04  Standard, high concentration, custody B                     │
│   /synthetic/07  Standard, verified costs, custody A          ◄ selected     │
│   /synthetic/09  Restricted, coverage ratio 0.62                             │
│   /synthetic/12  Ineligible, wash activity detected                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Request and response payloads | Sandbox API | on send | Partner |
| Signature verification result | Client-side against published key | on send | Partner |
| Synthetic borrower fixtures | Sandbox fixture set | STATIC | Partner |

---

# 12. System screens

## 12.1 S-70 — Notifications

**Route** `/notifications` · **PRD** §22.7, §27 webhook events

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA · Notifications                       [ All ]  ( Unread 3 )          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ● 14:31  ⛔ Credit restricted                                               │
│           Manufactured revenue detected. Limit reduced to 0.00 and new       │
│           draws blocked.                                    ( See evidence ) │
│  ● 12:47  ✓ Credit limit increased                                           │
│           1,690.00 → 2,530.00 USDC. Tier Standard → Strong.  ( Why? )        │
│  ● 11:19  ✓ Repayment applied                                                │
│           90.00 USDC — interest 0.24, principal 89.76.       ⧉ 0x4a71…       │
│    09:02  ⓘ Reserve target 98.3% reached                                     │
│    Aug 01 ✓ Draw completed — 800.00 USDC to 0x2b18…9e04      ⧉ 0x7c19…       │
│    Jul 31 ⚠ Concentration rose to 22% of revenue                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  DELIVERY                                                                    │
│   In-app        [x]  always on                                               │
│   Email         [x]  ops@quotestream.dev                                     │
│   Webhook       [x]  https://api.quotestream.dev/hooks/rivora                │
│                      signing secret whsec_…  ( Rotate )   ( Send test )      │
│                      last delivery 14:31:09 · 200 OK · 84ms                  │
│                                                                              │
│  SUBSCRIBED EVENTS                                                           │
│   [x] revenue.received          [x] credit.draw.completed                    │
│   [x] revenue.settled           [x] credit.repayment.completed               │
│   [x] risk.assessment.completed [x] borrower.watchlisted                     │
│   [x] credit.limit.updated      [x] borrower.restricted                      │
│   [x] borrower.defaulted        [ ] vault.utilization.changed                │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Notification stream | Event processor | RT | BOR |
| Delivery channels and targets | User settings | STATIC | BOR |
| Webhook secret, last delivery result | Webhook service | RT | BOR |
| Subscribed event types | PRD §27 webhook list | STATIC | BOR |

---

## 12.2 S-71 — Demo control panel

**Route** `/demo` · **PRD** §35.2, §37 · **Hackathon only**

Not a production screen. It exists so the three-minute demo is deterministic and so time compression is always visible rather than implied.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  RIVORA DEMO CONTROL                                    ⚠ Not production     │
├──────────────────────────────────────────────────────────────────────────────┤
│  SIMULATION CLOCK                                                            │
│   Simulated date   2026-08-01  (day 60 of 60)                                │
│   Compression      1 simulated day = 4 seconds        [ 1× ] [ 4× ] [ 16× ]  │
│   State            ▶ running          ( Pause )  ( Step 1 day )  ( Reset )   │
│                                                                              │
│   ⚠ Time compression is displayed on every screen while the demo runs.       │
│     Interest figures are computed against simulated elapsed time.            │
├──────────────────────────────────────────────────────────────────────────────┤
│  SCENARIO STEPS                                                              │
│   ✓ 1  Seed 30 days of revenue          266,000 auths · 10,000 eligible      │
│   ✓ 2  Assessment 1                     score 68 · limit 1,690               │
│   ✓ 3  Draw 1                           1,200.00 USDC                        │
│   ✓ 4  Improvement window               revenue +35% · success 88% → 96%     │
│   ✓ 5  Assessment 2                     score 78 · limit 2,530 (growth cap)  │
│   ✓ 6  Draw 2                           800.00 USDC                          │
│   ▶ 7  Automatic repayment              90.00/day · 22 days projected        │
│   ○ 8  Inject manufactured revenue      3 payers · 2,400.00                  │
│   ○ 9  Detection and restriction        score → 57 · limit → 0 · share → 35% │
│                                                                              │
│                     [ Run step 8 ]   ( Run all remaining )   ( Reset to 1 )  │
├──────────────────────────────────────────────────────────────────────────────┤
│  INJECTORS                                                                   │
│   ( Revenue spike +50% )      ( Revenue collapse −40% )                      │
│   ( Endpoint 503 for 10m )    ( Break endpoint binding )                     │
│   ( Refund wave 5% )          ( Add concentrated payer 45% )                 │
│   ( Vault utilization → 88% ) ( LP withdrawal 12,000 )                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  ENVIRONMENT                                                                 │
│   Network        Arc Testnet          Vault seed      25,000.00 USDC         │
│   Contracts      4 deployed  ✓        Indexer lag           1.4s  ✓          │
│   Probe service  running     ✓        Underwriter key  0xA9…    ✓            │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Data point | Source | Refresh | Tier |
| --- | --- | ---: | --- |
| Simulated date and compression factor | Demo clock | RT | Demo |
| Scenario step states | Scenario runner | RT | Demo |
| Injector actions | Scenario runner | on click | Demo |
| Environment health | Deployment + services | 10s | Demo |

---

# 13. Cross-cutting states

## 13.1 Empty states

| Screen | Condition | Treatment |
| --- | --- | --- |
| S-20 | Status OBSERVATION | Replaced entirely by S-14 |
| S-21 | No revenue yet | Requirement checklist from S-14, plus "your first payment will appear here within 10 seconds of settlement" |
| S-22 | No exclusions | "No revenue has been excluded. All 337,500 settled payments were eligible." — a positive, not a blank |
| S-24 | No limit yet | Constraint ladder shown with the observation requirement as the binding constraint |
| S-28 | One assessment | Chart hidden, single row shown |
| S-40 | No position | Vault stats shown in full, position card replaced by the deposit CTA |
| S-42 | No queue | Queue section omitted rather than shown empty |
| S-51 | No watchlist | "No borrowers on watch. 7 active, mean score 71." |
| S-70 | No notifications | Subscription settings shown alone |

## 13.2 Loading and error

```text
Loading      Skeleton blocks at the exact final dimensions. Never a spinner
             over a populated layout — values must not shift.

Stale data   Any value older than 30s renders with a ⏱ prefix and its age on
             hover. Underwriting values are never silently stale.

Chain error  ⚠ Arc RPC unreachable. Showing last known state from 14:28 UTC.
             Actions requiring a transaction are disabled.

Indexer lag  ⚠ Revenue data is 4m behind the chain. Assessments are paused
             until the indexer catches up.

Probe fail   Endpoint probe failures are never hidden. A failed probe on S-29
             promotes to a full-screen alarm state.

Tx failure   The specific revert reason is surfaced, mapped to a human string.
             "Draw exceeds available credit: requested 400.00, available
             130.00" — never "transaction failed".
```

## 13.3 Responsive behaviour

```text
≥ 1280px   Full layout as drawn. Three-column stat rows.
 960px     Stat rows collapse to two columns. Charts keep full width.
 640px     Single column. Constraint ladders and factor tables become
           vertically stacked cards. Wide tables scroll horizontally
           inside their own container; the page never scrolls sideways.
 < 640px   Operator screens are not supported below 960px and show a
           notice. Borrower and LP screens remain fully usable.
```

## 13.4 Accessibility and numeric display

```text
Currency      Always two decimals, always with the USDC suffix on first
              occurrence in a block. Thousands separated.
Percentages   Two decimals for rates and utilization, one for factors.
Deltas        Always signed, with direction glyph and colour, never colour
              alone — ▲ +35% and ▼ −21 are readable without colour.
Addresses     Truncated 6+4, full value in title attribute and on copy.
Status        Never colour alone. Every status carries a glyph and a word.
Charts        Every chart has a table equivalent behind a "view as table"
              control. Sparklines carry a text summary.
Time          UTC everywhere, with local time on hover. Durations are
              rendered as "22 days", never as a bare number.
```

---

# 14. Coverage matrix

Every PRD requirement that implies an interface, mapped to the screen that satisfies it.

| PRD | Requirement | Screens |
| --- | --- | --- |
| §11.4 | Endpoint binding and continuous verification | S-11, S-29 |
| §11.5 | Routed-revenue coverage ratio | S-29, S-51, S-52 |
| §13.4 | Repayment horizon shown to borrower | S-24, S-25 |
| §14.5 | Explainable decision with binding constraint | S-24, S-27, S-28 |
| §15.5 | Interest coverage as a draw precondition | S-25 |
| §19.4 | Default registry, publicly queryable | S-04 |
| §19.5 | Cure path | S-33 |
| §19.6 | Portable attestations | S-03, S-61 |
| §21.2 | Disclosure tiers enforced per surface | All — see per-screen tables |
| §21.4 | Router-throughput disclosure at onboarding | S-13 |
| §22.1 | Onboarding under ten minutes, ownership verified | S-10 – S-13 |
| §22.2 | Revenue analytics with exclusion reasons | S-21, S-22 |
| §22.3 | Assessment history, deterministic reproduction | S-27, S-28 |
| §22.4 | Borrowing with validation and events | S-25 |
| §22.5 | Repayment, interest first, excess returned | S-26 |
| §22.6 | LP deposit, withdraw, exposure, losses | S-40 – S-44 |
| §22.7 | Risk monitoring and notification | S-50 – S-53, S-70 |
| §22.8 | Agent spending controls | S-30 |
| §23.4 | Withdrawal queue with position and estimate | S-42 |
| §23.5 | Utilization-linked withdrawal fee | S-42 |
| §23.7 | Bootstrap subsidy shown separately from organic yield | S-40, S-44 |
| §23.8 | Vault monitoring thresholds | S-50, S-54 |
| §28.2 | Score API and partner surface | S-60, S-61 |
| §29.1–29.6 | All six named UX surfaces | S-01, S-20, S-21, S-24, S-40, S-50 |
| §31.5 | Economic security caps visible and enforced | S-54, S-55 |
| §32 | Testnet and experimental-score disclaimers | S-01, S-13, S-41 |
| §33 | Explainability and auditability | S-22, S-27, S-52, S-53 |
| §36 | All 15 MVP acceptance criteria | S-01, S-14, S-20 – S-27, S-40, S-71 |
| §37 | Three-minute demo path | S-20, S-21, S-24, S-25, S-27, S-29, S-53, S-71 |

## 14.1 Minimum set for the hackathon MVP

Fourteen screens carry the full demo and every acceptance criterion in PRD §36.

```text
S-01  Landing                 S-24  Credit
S-10  Onboarding (collapsed)  S-25  Draw request
S-11  Endpoint binding        S-27  Assessment explanation
S-14  Observation             S-29  Custody and binding
S-20  Borrower dashboard      S-40  LP dashboard
S-21  Revenue analytics       S-50  Risk console overview
S-22  Excluded revenue        S-53  Anomaly detail
                              S-71  Demo control panel
```

Everything else is Phase 1 or later.
