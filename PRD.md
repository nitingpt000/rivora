# Rivora

## Product Requirements Document

**Product:** Rivora
**Category:** Stablecoin-native DeFi, agentic finance and revenue-based lending
**Network:** Arc
**Settlement asset:** USDC
**Version:** 1.1
**Initial release:** Hackathon MVP
**Primary users:** AI API providers, MCP servers, autonomous agents, inference services and liquidity providers

---

# 1. Executive Summary

Rivora is a stablecoin-native credit protocol that provides working-capital credit lines to AI agents, APIs and autonomous digital services.

Instead of relying on traditional collateral, personal guarantees or conventional credit reports, Rivora underwrites borrowers using their verifiable onchain revenue, service performance and customer-quality signals.

The protocol introduces a new financial asset class:

> **Machine-generated receivables**

An API provider may receive thousands of small USDC payments through x402 and Circle Nanopayments. Although the service generates recurring revenue, it may still need immediate capital to pay for:

* GPU compute
* AI model APIs
* Cloud infrastructure
* Storage
* Data providers
* Agent-to-agent services
* Developer operations
* Security and monitoring
* Other machine-service expenses

Rivora evaluates the service’s revenue history and operating performance, assigns a dynamic credit limit and allows it to borrow USDC from a liquidity pool.

A configurable percentage of future revenue is automatically routed toward repayment.

```text
x402 and nanopayment revenue
              │
              ▼
      Rivora Revenue Router
              │
      ┌───────┼───────────┐
      │       │           │
      ▼       ▼           ▼
Repayment   Reserve   Provider wallet
   20%        2%           78%
```

Rivora combines:

* Revenue-based financing
* Autonomous underwriting
* Programmable repayment
* Stablecoin liquidity
* Machine identity and reputation
* Onchain risk monitoring
* Agent-controlled wallets
* DeFi liquidity pools

Arc is suitable for the protocol because it is an EVM-compatible Layer-1 designed around stablecoin financial applications, uses USDC as its native gas asset and provides deterministic finality in under one second.

Circle Nanopayments extends x402 with batched settlement of signed payment authorizations, making sub-cent machine-to-machine USDC payments economically practical.

---

# 2. Why Now

Rivora depends on four enabling conditions that converged only recently. None of them is individually sufficient.

## 2.1 Machine-to-machine payments became economically viable

x402 revived the dormant HTTP 402 status code as a payment-negotiation primitive. Circle Nanopayments extends it with batched settlement of signed authorizations.

Before batched settlement, a 0.004 USDC API call could not be settled onchain for less than the value of the call itself. Per-request machine revenue simply did not exist as observable data.

## 2.2 A stablecoin-native settlement layer exists

Arc provides EVM execution with USDC as the native gas asset and sub-second deterministic finality.

Credit accounting denominated in the same asset used for gas, revenue, repayment and reserves removes the FX and volatility exposure that makes stablecoin credit on general-purpose chains operationally awkward.

## 2.3 Autonomous services can hold and spend their own funds

Circle Agent Wallets provide policy-controlled wallets that an agent can operate directly.

A credit line is only useful if the borrower can deploy it. Before programmable agent wallets with enforceable spending policies, lending to an autonomous service had no safe execution path.

## 2.4 Machine services now generate observable recurring revenue

AI APIs, MCP servers and inference providers have begun billing per request in stablecoins.

This produces exactly the data an underwriter requires — payer identity, request outcome, timestamp and amount — natively and continuously, without accounting exports, bank statements or self-reported financials.

## 2.5 Why the window matters

```text
Observable per-request revenue     (x402 + Nanopayments)
            +
Stablecoin-denominated settlement  (Arc + USDC gas)
            +
Programmable borrower spending     (Agent Wallets)
            +
A borrower population that exists  (AI APIs, MCP servers)
            =
Underwritable machine cash flow
```

Any three of these without the fourth produces a demonstration rather than a credit market. All four together make revenue-based credit for machine businesses buildable for the first time.

---

# 3. Product Vision

## 3.1 Vision statement

> Rivora will become the credit and financial-reputation layer for autonomous digital businesses.

Any agent, API, MCP server, data service or compute provider with verifiable revenue should be able to access working capital without relying on traditional corporate credit infrastructure.

## 3.2 Long-term outcome

Rivora should allow autonomous services to:

1. Build an onchain revenue history.
2. Establish a machine credit profile.
3. Receive a dynamic USDC credit line.
4. Borrow capital programmatically.
5. Spend within predefined wallet policies.
6. Repay automatically from future revenue.
7. Improve credit terms through reliable operation.
8. Access insurance, equipment financing and tokenized credit markets.

## 3.3 Positioning

Rivora is not merely an AI lending dashboard.

It is:

> **An onchain working-capital protocol for machine-operated businesses.**

---

# 4. Problem Statement

## 4.1 Primary problem

Autonomous digital services can generate revenue but cannot easily access credit.

Traditional lenders typically evaluate:

* Company financial statements
* Bank account records
* Tax filings
* Personal or corporate guarantees
* Credit bureau records
* Physical assets
* Human ownership structures

These mechanisms do not map cleanly to autonomous services that:

* Operate through blockchain wallets
* Receive thousands of small payments
* Serve customers globally
* Have no conventional payroll
* Purchase other machine services
* Change revenue rapidly
* May be operated by an agent rather than an employee
* Have limited or no traditional credit history

## 4.2 Working-capital mismatch

An AI service may receive revenue continuously while incurring expenses before its payments are fully available.

Example:

```text
Daily revenue                 400 USDC
Daily model API costs         180 USDC
Daily cloud and GPU costs     120 USDC
Data and agent-service costs   40 USDC
Operating margin               60 USDC
```

A temporary increase in demand may require the service to purchase additional compute before receiving corresponding customer revenue.

Without working capital, the service may:

* Reject profitable requests
* Experience downtime
* Fail to scale capacity
* Delay payments to dependent services
* Lose customers
* Create a cascading failure across agent workflows

## 4.3 Lender visibility problem

A lender cannot safely provide credit merely because a wallet has received USDC.

The lender must determine:

* Whether payments represent genuine revenue
* Whether revenue is recurring
* Whether customers are independent
* Whether transactions are self-funded
* Whether the service successfully fulfils requests
* Whether revenue is growing or declining
* Whether revenue can be redirected away from repayment
* Whether the borrower already has other liabilities

Rivora addresses these questions through verifiable payment and operating data.

---

# 5. Competitive Landscape

## 5.1 Adjacent categories

| Category | Representative providers | Underwriting basis | Why it does not serve machine businesses |
| --- | --- | --- | --- |
| Web2 revenue-based financing | Stripe Capital, Pipe, Capchase, Founderpath | Platform-observed card or SaaS revenue, corporate identity | Requires a legal entity, a bank account and a payment-processor relationship. Cannot underwrite a pseudonymous or agent-operated service. Settlement in days, not seconds. |
| Onchain receivables credit | Huma Finance and similar PayFi protocols | Real-world receivables and payment-order flow | Closest structural comparable. Oriented toward human and institutional payment flows rather than per-request machine revenue. No integration with agent spending policy. |
| Undercollateralized onchain credit | Goldfinch, Centrifuge, Maple | Human underwriters, offchain legal recourse, pool delegates | Underwriting is manual and slow relative to a borrower whose revenue profile changes weekly. Minimum ticket sizes are far above machine working-capital needs. |
| Overcollateralized lending | Aave, Morpho, Compound, Euler | Posted crypto collateral | Requires the borrower to already hold the capital it wants to borrow. Structurally useless as working capital. |
| Compute credit and cloud terms | GPU marketplaces, cloud provider credit lines | Vendor relationship, prepayment | Single-vendor, non-portable, no cash liquidity, no credit history accrual. |

## 5.2 Rivora's position

> Machine-native receivables credit: underwritten from per-request stablecoin revenue, disbursed to a policy-controlled agent wallet, repaid automatically from routed future revenue.

The differentiator is not any single component. It is that the underwriting data, the disbursement rail, the spending controls and the repayment mechanism are all the same programmable substrate.

## 5.3 Why a healthy borrower chooses Rivora

Rivora must have an answer to adverse selection. If the only borrowers who apply are those rejected by cheaper capital, the loan book is structurally impaired.

A well-performing AI API chooses Rivora because:

* **Speed.** Underwriting completes in seconds from data the protocol already observes. There is no application, data room or diligence call.
* **No dilution and no personal guarantee.** Revenue-based repayment is not equity and not a directors' guarantee.
* **No banking prerequisite.** A service earning USDC does not need a corporate bank account, a payment processor relationship or an established jurisdiction.
* **It works for non-human operators.** An autonomous agent cannot sign a loan agreement or pass a consumer credit check. It can prove revenue.
* **Repayment is proportional.** Debt service scales with revenue, so a slow week does not create a missed fixed payment.
* **The credit line compounds.** Repayment performance is recorded and portable, so borrowing capacity improves with operating history rather than resetting at each new financing.

Rivora should not attempt to compete on headline interest rate. It competes on availability, latency and the fact that no alternative underwrites this borrower at all.

## 5.4 Where Rivora is structurally weaker

Stated plainly, because it drives strategy:

* Cost of capital will exceed bank or platform lending for any borrower that qualifies for both.
* Legal recourse against a defaulting pseudonymous borrower is weak. See the reputation and enforcement section.
* Revenue observability is only as strong as the settlement binding. See the revenue custody section.

These constraints are the reason the recommended strategy begins as a permissioned network with known operators.

---

# 6. Product Thesis

Rivora is based on five core assumptions.

## 6.1 Onchain revenue can support underwriting

Machine-service revenue can be observed directly rather than reported manually.

## 6.2 Revenue should be evaluated, not merely counted

Ten thousand USDC from one related wallet is less reliable than ten thousand USDC from hundreds of independent recurring customers.

## 6.3 Repayment should be embedded into revenue collection

A protocol-controlled revenue router reduces the risk that borrowers redirect all future revenue.

## 6.4 Credit limits should change continuously

Autonomous businesses can change rapidly. Credit limits should respond to:

* Revenue growth
* Revenue decline
* Service reliability
* Customer concentration
* Existing debt
* Payment failures
* Refunds
* Liquidity conditions

## 6.5 AI may analyse risk, but deterministic policies must control funds

An underwriting agent can interpret signals and recommend limits. However, lending, withdrawal, repayment and liquidation decisions must remain constrained by explicit protocol rules.

---

# 7. Product Goals

## 7.1 Primary goals

Rivora must:

1. Track verifiable x402 and nanopayment revenue.
2. Generate an explainable borrower risk profile.
3. Calculate dynamic USDC credit limits.
4. Allow approved services to borrow from a USDC vault.
5. Route future revenue automatically toward repayment.
6. Protect liquidity providers through reserves and exposure limits.
7. Adjust credit terms when borrower performance changes.
8. Provide transparent onchain loan and repayment records.
9. Demonstrate autonomous financial decision-making.
10. Support a clear path from hackathon prototype to production protocol.

## 7.2 Secondary goals

Rivora should eventually support:

* Revenue advances
* Revolving credit lines
* GPU and compute financing
* Invoice and receivable tokenization
* Revenue-forward contracts
* Agent credit scores, portable across marketplaces
* Underwriting and scoring sold as infrastructure
* Buy-side credit for consuming agents
* Credit insurance
* Multi-lender syndication
* Fixed-income credit pools
* Crosschain revenue aggregation
* Stablecoin FX and treasury management

## 7.3 Non-goals for the MVP

The hackathon MVP will not include:

* Undercollateralized anonymous public lending
* Real-money mainnet lending
* Fiat bank account underwriting
* Full decentralized governance
* Cross-jurisdiction consumer lending
* Complex liquidation auctions
* A secondary market for loan positions
* Production-grade machine-learning underwriting
* Unrestricted autonomous agent spending
* Multiple collateral assets
* Multi-currency debt

---

# 8. Target Users

## 8.1 AI API provider

A company or developer operating a paid AI API.

Examples:

* Text-generation API
* Image-analysis API
* Speech-processing API
* Embedding service
* Document-extraction API
* Code-analysis service

### Needs

* Pay model providers before all customer revenue settles
* Scale compute during demand spikes
* Avoid rejecting profitable requests
* Build credit without traditional banking history

---

## 8.2 MCP server operator

An operator providing paid tools to autonomous agents through an MCP server.

Examples:

* Search and retrieval
* Business-data enrichment
* Document processing
* Financial analysis
* Compliance screening
* Code execution

### Needs

* Purchase upstream data
* Pay third-party APIs
* Finance infrastructure growth
* Maintain service availability

---

## 8.3 Autonomous service agent

A software agent that independently sells services and purchases required inputs.

Examples:

* Research agent
* Lead-generation agent
* Trading-data agent
* Procurement agent
* Coding agent
* Content-production agent

### Needs

* Obtain an operating budget
* Pay for downstream services
* Manage cash flow
* Borrow within explicit policies
* Repay without human intervention

Circle Agent Wallets are designed to support agent-controlled USDC activity with configurable policies and compliance controls, while Agent Nanopayments allow agents to purchase x402-compatible services using sub-cent USDC payments.

---

## 8.4 Liquidity provider

A user or institution depositing USDC into Rivora’s credit vault.

### Needs

* Earn yield from economically productive lending
* Understand borrower exposure
* Observe vault utilization
* Monitor defaults and reserves
* Withdraw according to vault-liquidity rules

---

## 8.5 Risk manager

A protocol operator or governance participant responsible for lending parameters.

### Needs

* Set exposure limits
* Review suspicious revenue
* Restrict borrowers
* Pause lending
* Manage reserves
* Analyse portfolio concentration

---

# 9. Jobs to Be Done

## Borrower jobs

* When my service experiences increased demand, provide enough capital to purchase additional compute.
* When I establish recurring onchain revenue, convert that history into a usable credit limit.
* When I receive revenue, automatically repay my debt without manual treasury operations.
* When my service performance improves, increase my borrowing capacity.
* When revenue temporarily declines, reduce my exposure before I default.

## Liquidity-provider jobs

* When I deposit USDC, allocate it to transparent revenue-backed credit.
* When borrowers repay interest, distribute my share accurately.
* When risk increases, protect my capital through reserves, limits and restrictions.
* When I request withdrawal, show when liquidity will be available.

## Protocol jobs

* Distinguish genuine operating revenue from manipulated transaction volume.
* Prevent borrowers from bypassing the repayment router.
* Explain why a credit limit increased or decreased.
* Ensure an AI recommendation cannot violate protocol risk limits.

---

# 10. Core Product Concepts

## 10.1 Borrower

A registered service with:

* A unique Rivora borrower ID
* An operating wallet
* One or more revenue endpoints
* A revenue-router contract
* A risk profile
* A credit limit
* An outstanding balance
* A reserve balance
* A machine reputation record

## 10.2 Revenue source

A payment channel approved for underwriting.

Initial supported source:

* x402 API payments settled through Circle Nanopayments

Future sources:

* Direct USDC payments
* Subscription payments
* Marketplace settlements
* Agent job escrow
* Usage-based SaaS payments
* Crosschain Gateway balances

## 10.3 Eligible revenue

Revenue that satisfies Rivora’s underwriting conditions.

A payment may be excluded when:

* The payer is related to the borrower.
* The payment was refunded.
* The service request failed.
* The payment is unusually large.
* The payer wallet is newly funded by the borrower.
* The same economic entity controls both wallets.
* The payment does not correspond to a verifiable service request.
* The transaction is part of detected wash activity.

## 10.4 Credit line

The maximum outstanding principal the borrower may have at a given moment.

```text
Available credit =
Approved credit limit
− Outstanding principal
− Pending draw requests
```

## 10.5 Revenue router

A smart contract that receives borrower revenue and splits it according to protocol rules.

Default allocation:

```text
20%  Loan repayment
 2%  Loss reserve
78%  Borrower operating wallet
```

The percentages should be configurable according to risk.

## 10.6 Loss reserve

A borrower-specific reserve funded from revenue.

It may be used to cover:

* Missed repayment
* Temporary revenue decline
* Refunds
* Protocol-defined borrower losses

## 10.7 Credit vault

A pool into which liquidity providers deposit USDC.

The vault:

* Provides borrower liquidity
* Receives principal repayments
* Receives interest
* Accounts for reserves and losses
* Issues vault shares to liquidity providers

## 10.8 Underwriting agent

An offchain service that:

* Reads revenue and service signals
* Detects anomalies
* Calculates risk factors
* Recommends credit-limit adjustments
* Produces an explanation
* Submits a signed recommendation

The smart contract validates that the recommendation remains within protocol limits.

---

# 11. Revenue Custody and Settlement Binding

This section resolves the single assumption on which the entire protocol depends.

## 11.1 The problem

Every underwriting control in Rivora assumes that borrower revenue arrives at a protocol-controlled Revenue Router. If revenue can reach the borrower without passing through the router, then:

* Repayment is voluntary rather than structural.
* The anti-diversion controls are advisory rather than enforceable.
* Observed revenue is a lower bound on true revenue, not a measurement of it.
* The credit line is effectively an unsecured loan to a pseudonymous counterparty.

Circle Nanopayments aggregates signed payment authorizations and settles **net positions in batches**. Funds therefore arrive at a registered settlement destination on the settlement schedule, not as one transfer per API call. The naive statement "revenue is settled into the Revenue Router" is not automatically true — it is a configuration that must be established and continuously verified.

## 11.2 Custody models

Three models are possible, in descending order of enforceability. Rivora treats the model in force as an **underwriting input**, not an implementation detail.

### Model A — Router as registered settlement destination

The borrower registers the `RivoraRevenueRouter` contract address as the settlement destination for its x402 or nanopayment revenue. Settled batches land directly in the router, which executes the waterfall atomically on receipt.

```text
Payer ──signed authorization──► Nanopayment settlement
                                       │
                                       ▼
                        RivoraRevenueRouter (settlement destination)
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
            Credit Vault        Loss reserve        Operating wallet
```

* Diversion requires the borrower to change the registered settlement destination, which is an observable event.
* This is the only model in which repayment is genuinely structural.

### Model B — Settlement to a policy-constrained Agent Wallet

Settlement lands in a Circle Agent Wallet whose spending policy permits an outbound transfer to the Revenue Router before other outbound categories, with Rivora holding a policy-change veto or co-signer role.

* Repayment is enforced by wallet policy rather than by contract atomicity.
* Enforceability depends on whether the policy layer can be unilaterally modified by the borrower.

### Model C — Post-settlement sweep with attestation

Settlement lands in a borrower-controlled address. The borrower's agent sweeps a defined share to the router on a schedule. Rivora observes the settlement address and compares swept amounts to observed settlement inflows.

* Repayment is contractual and behavioural, not structural.
* Detection of diversion is possible; prevention is not.

## 11.3 Custody model determines the advance rate

The maximum advance rate is bounded by the custody model in force. This makes the integration question economically explicit rather than a footnote.

| Custody model | Repayment enforceability | Maximum advance rate | Maximum limit |
| --- | --- | ---: | ---: |
| A — Router is settlement destination | Structural | 100% of tier base | Tier cap |
| B — Policy-constrained agent wallet | Policy-enforced | 50% of tier base | 50% of tier cap |
| C — Post-settlement sweep | Behavioural | 25% of tier base | 25% of tier cap, and never above the borrower loss reserve plus security bond |

A borrower operating under Model C is, in effect, borrowing close to the value of its own posted reserve. This is the correct outcome: unenforced repayment should not receive unsecured credit.

## 11.4 Endpoint binding and continuous verification

Registering a router address once is insufficient. The borrower can redirect future customers to a different `payTo` address at any time.

### Registration-time binding

1. Borrower registers endpoint URL and router address.
2. Rivora issues a nonce challenge.
3. Borrower serves the nonce at a well-known path on the endpoint domain, or signs it with the endpoint's advertised payment key.
4. Rivora requests the endpoint without payment and parses the returned `402` challenge.
5. The `payTo` field in the challenge must equal the registered router address.
6. Binding is recorded onchain as `keccak256(endpointURL, routerAddress, ownerWallet)`.

### Continuous verification

Rivora re-probes each registered endpoint on a randomized schedule.

```text
For each registered endpoint, every N minutes:

  1. Issue an unpaid request.
  2. Parse the 402 payment-required challenge.
  3. Compare advertised payTo with the bound router address.

  If payTo != bound router:
      → immediate RESTRICTED status
      → block all new draws
      → escalate repayment allocation
      → raise a risk-console alert

  If the endpoint does not respond:
      → decrement the uptime component of the reliability factor
      → after the configured grace period, move to WATCH
```

This probe is cheap, deterministic and observed entirely by the protocol. It is the strongest anti-diversion control available and it does not depend on borrower cooperation.

## 11.5 Routed-revenue coverage ratio

Endpoint probing detects a changed `payTo`. It does not detect a second, unregistered endpoint serving the same service.

Rivora therefore tracks a coverage ratio:

```text
Expected routed revenue =
    observed paid request count × observed mean price

Coverage ratio =
    actual routed revenue / expected routed revenue
```

| Coverage ratio | Interpretation | Action |
| ---: | --- | --- |
| ≥ 0.95 | Consistent | None |
| 0.80 – 0.95 | Minor leakage or pricing drift | Log, review at next assessment |
| 0.50 – 0.80 | Material unexplained shortfall | WATCH, reduce limit, block increases |
| < 0.50 | Probable diversion | RESTRICTED, escalate repayment allocation |

A sustained coverage ratio below the diversion threshold is a default trigger.

## 11.6 Settlement timing and the repayment race

Nanopayment batching introduces a lag between a customer paying and funds arriving.

```text
t0   Customer signs payment authorization
t1   Authorization aggregated into a batch
t2   Batch settles net position to the settlement destination
t3   Router executes waterfall
```

Consequences the protocol must handle:

* **Interest accrues between t0 and t3.** Repayment is applied at t3, not t0. The interest-coverage requirement must be sized against the observed settlement interval, not against instantaneous revenue.
* **Revenue recognized for underwriting is measured at t0; revenue available for repayment is measured at t3.** These are different series and must be stored separately. The data model distinguishes `paidAt` from `settledAt` for exactly this reason.
* **A borrower in DELINQUENT status may have unsettled revenue in flight.** The default grace period must exceed the maximum observed settlement interval, or the protocol will default borrowers whose repayment is already in the batch queue.
* **Net settlement can offset.** If the same entity both earns and spends through the same settlement account, a net position may be smaller than gross revenue. Underwriting must use gross inbound authorizations; repayment capacity must use net settled amounts.

## 11.7 MVP decision

For the hackathon MVP, Rivora implements **Model A** against a simulated settlement source, with the endpoint-binding probe and the coverage ratio both live.

The MVP must not represent Model A as confirmed production behaviour until the following are verified against Circle's production interfaces:

1. Whether an arbitrary contract address may be registered as a nanopayment settlement destination.
2. Whether a settlement destination change is observable to a third party, and with what latency.
3. Whether settlement to a contract triggers contract execution, or requires a pull-based claim.
4. Whether per-payer attribution survives net batch settlement, or whether attribution must be reconstructed from the pre-settlement authorization feed.
5. Whether the authorization feed is available to the payee's designated underwriter.

Items 4 and 5 determine whether the customer-diversity and concentration factors are computable at all. If per-payer attribution is unavailable, those factors must be dropped from the MVP formula and the advance rate reduced accordingly.

---

# 12. Revenue Collection and Repayment

## 12.1 x402 payment flow

```text
1. Customer or agent requests a paid API resource.

2. API responds with HTTP 402 Payment Required.

3. Customer signs a USDC payment authorization.

4. Circle Nanopayments processes the authorization.

5. Successful payment allows access to the API resource.

6. Payment revenue is attributed to the Rivora borrower.

7. Revenue is settled into the Revenue Router.

8. Revenue Router executes the repayment waterfall.
```

Circle’s seller integration supports an API returning `402 Payment Required` and serving the resource after receipt of a valid payment signature. Nanopayments adds gas-free batched settlement alongside standard x402 payment methods.

## 12.2 Revenue waterfall

For each settled revenue batch:

```text
Gross revenue
    │
    ├── Protocol-designated repayment percentage
    │
    ├── Borrower loss-reserve percentage
    │
    └── Remaining operating revenue
```

### Base example

```text
Revenue received:              100.00 USDC
Repayment allocation:           20.00 USDC
Loss reserve:                    2.00 USDC
Provider operating balance:     78.00 USDC
```

## 12.3 Waterfall when no debt exists

When outstanding debt is zero:

```text
2%  → Loss reserve until reserve target is met
98% → Provider wallet
```

After the reserve target is reached:

```text
100% → Provider wallet
```

Rivora may continue deducting a protocol service fee in later versions.

## 12.4 Excess repayment handling

When the repayment allocation exceeds the remaining debt:

1. Repay the complete outstanding amount.
2. Send the unused amount to the borrower’s operating wallet.
3. Mark the credit line as fully repaid.
4. Update borrower reputation.
5. Recalculate borrowing capacity.

---

# 13. Underwriting Model

## 13.1 Design principles

The underwriting model must be:

* Explainable
* Resistant to obvious manipulation
* Conservative during limited history
* Responsive to genuine growth
* Deterministically bounded
* Independent of a single AI-model output

## 13.2 Normalized revenue base

The limit is derived from a normalized revenue figure rather than raw trailing revenue. Raw revenue is trivially inflated by a single spike day.

### Time-weighted revenue

Recent revenue is weighted more heavily than older revenue:

```text
R_weighted = Σ ( revenue_d × w_d )  for d in the trailing 30 days

w_d = λ^(age_in_days) , normalized so Σ w_d = 30 / Σ λ^d

λ = 0.97   (approximately a 23-day half-life)
```

### Spike clamp

The weighted figure is then clamped against the median to prevent a burst from driving the limit:

```text
R_30 = min( R_weighted , median_daily_revenue × 30 × k )

k = 1.5
```

A borrower whose revenue is genuinely and steadily growing sees the mean and median rise together, so the clamp does not bind. A borrower who manufactures three large days sees the clamp bind hard.

### Seasoning

Revenue becomes eligible for underwriting only after a seasoning delay, so that refunds and reversals resolve before the revenue supports credit.

```text
Seasoning delay = 3 days from settlement
```

## 13.3 Credit-limit formula

The MVP limit is the minimum of a quality-derived limit and a set of hard constraints.

### Quality-derived limit

```text
L_quality = R_30 × A(tier) × Q × G
```

Where:

```text
L_quality   proposed limit before constraints
R_30        normalized eligible trailing 30-day revenue (13.2)
A(tier)     base advance rate for the borrower's tier (14.4)
Q           composite quality factor, 0 < Q ≤ 1
G           revenue-growth multiplier, may exceed 1 (13.9)
```

### Composite quality factor

The earlier draft multiplied six sub-unit factors together. That compounds too harshly: a competent borrower scoring 0.85 on every dimension receives `0.85^6 ≈ 0.38`, turning a stated 30% advance rate into an effective 11%. The stated advance rate then means nothing.

Rivora instead applies weighted penalties against a base of one:

```text
Q = clamp( 1 − Σ wᵢ × (1 − fᵢ) , Q_min , 1 )

Q_min = 0.35
```

| Factor | Symbol | Weight wᵢ |
| --- | --- | ---: |
| Service reliability | S | 0.30 |
| Customer concentration | C | 0.25 |
| Revenue volatility | V | 0.15 |
| Revenue diversity | D | 0.15 |
| Operating capacity | M | 0.15 |

The weights sum to 1.00, so `Q` is interpretable: `Q = 0.85` means the borrower carries a 15% quality haircut, and each factor's contribution to that haircut is directly readable. This is what makes the explanation in 14.5 mechanical rather than narrated.

Growth is applied as a separate multiplier because, unlike the others, it may legitimately exceed 1.

### Binding constraints

```text
L = min(
      L_quality,                    quality-derived limit
      L_horizon,                    repayment-horizon limit (13.4)
      L_custody,                    custody-model cap (11.3)
      L_tier_cap,                   absolute cap for the borrower's tier
      L_new_borrower,               cap while history < 90 days
      L_previous × growth_cap,      per-assessment increase cap
      L_exposure                    per-borrower share of vault assets
    )
```

```text
growth_cap     = 1.50 per assessment
L_new_borrower = 2,500 USDC
L_exposure     = 5% of total vault assets
```

Every constraint that binds must be named in the decision explanation. A borrower whose limit is capped by the growth cap rather than by quality should be told so, because the correct action for that borrower is to wait, not to improve.

## 13.4 Repayment horizon and the derivation of the advance rate

The earlier draft set the advance rate at 30% without stating a repayment period. A credit limit expressed as a share of monthly revenue is meaningless without one: the same 30% advance repays in 45 days at a 20% revenue share and in 180 days at a 5% share. The advance rate is not a free parameter — it is a consequence of the routing percentage and the maximum horizon the protocol will tolerate.

### Payback time

```text
T_payback = P / ( R_daily × repaymentBps / 10,000 )

P        outstanding principal
R_daily  eligible daily revenue
```

### Horizon-constrained limit

Requiring `T_payback ≤ T_max` at full utilization gives:

```text
L_horizon = R_daily × ( repaymentBps / 10,000 ) × T_max

          = R_30 × ( repaymentBps / 10,000 ) × ( T_max / 30 )
```

### The advance rate is therefore derived

```text
A_max = ( repaymentBps / 10,000 ) × ( T_max / 30 )
```

| Repayment share | T_max | Implied maximum advance rate |
| ---: | ---: | ---: |
| 20% | 30 days | 20% |
| 20% | 45 days | 30% |
| 20% | 60 days | 40% |
| 30% | 45 days | 45% |
| 15% | 60 days | 30% |

The 30% figure carried in the earlier draft is recovered exactly by a 20% repayment share over a 45-day horizon. It is retained, but now as a derived quantity rather than an assumption.

To raise a borrower's advance rate the protocol must either increase the routed repayment share or extend the horizon. Both are explicit risk decisions and both are visible to the borrower.

### Stressed horizon

The base horizon assumes revenue holds. A second constraint assumes it does not:

```text
R_daily_stressed = R_daily × 0.70

T_payback_stressed ≤ 90 days
```

A limit that repays in 45 days at current revenue but would take more than 90 days after a 30% revenue decline is reduced until it satisfies both.

### Maximum horizon by tier

```text
Prime        60 days
Strong       60 days
Standard     45 days
Restricted   no new draws
```

## 13.5 Service-reliability factor

Service reliability carries the heaviest weight in the quality factor. It must therefore be the factor a borrower is least able to influence by assertion.

### Provenance requirement

**No component of `S` may be self-reported.** A borrower that reports its own success rate into its own most heavily weighted factor is setting its own credit limit. Every input below is either observed by the protocol or derived from customer behaviour.

| Component | Symbol | Weight | Source | Borrower can falsify? |
| --- | --- | ---: | --- | --- |
| Settlement success ratio | P_s | 0.35 | Ratio of authorizations that settled to authorizations issued, from the payment feed | No |
| Protocol uptime probe | U | 0.25 | Rivora's own randomized health probes against the registered endpoint | No |
| Probe response latency | R_t | 0.15 | Measured by the same probe | No |
| Refund and reversal rate | Q_r | 0.15 | Observed refunds and chargebacks against settled revenue | No — falsifying requires refunding real money |
| Repeat-customer retention | Q_c | 0.10 | Share of prior-period payers who paid again this period | Only by paying itself, which the related-wallet controls exclude |

```text
S = 0.35·P_s + 0.25·U + 0.15·R_t + 0.15·(1 − refund_rate) + 0.10·Q_c
```

All components are normalized between zero and one.

### Worked example

```text
Settlement success ratio:      0.96
Uptime probe score:            0.99
Latency score:                 0.90
Refund rate:                   0.03  →  0.97
Repeat-customer retention:     0.62

S = 0.35(0.96) + 0.25(0.99) + 0.15(0.90) + 0.15(0.97) + 0.10(0.62)

S = 0.336 + 0.248 + 0.135 + 0.146 + 0.062

S = 0.927
```

### Note on the discarded quality score

The earlier draft included a borrower-reported "quality or customer-confirmation score" at a 15% weight. It is removed. Customer-signed fulfilment attestations may reintroduce a genuine quality signal in a later version, but only once the signature is verifiable and the signer is established as an unrelated party.

Refund rate and repeat-customer retention are used as the proxy in the interim, because both are revealed preference: a customer who was served badly refunds or does not return, and neither behaviour is available to the borrower as a costless assertion.

## 13.6 Revenue-diversity factor

The diversity factor considers:

* Number of unique customers
* Percentage of repeat customers
* Geographic or network diversity
* Revenue distribution across customers

Example mapping:

| Unique eligible customers | Diversity factor |
| ------------------------: | ---------------: |
|                       1–3 |             0.40 |
|                      4–10 |             0.60 |
|                     11–25 |             0.75 |
|                    26–100 |             0.90 |
|             More than 100 |             1.00 |

## 13.7 Customer-concentration factor

Customer concentration is measured using the Herfindahl-Hirschman Index:

```text
HHI = Σ (sᵢ)²    for i = 1…n

sᵢ   proportion of eligible revenue generated by customer i
n    number of eligible customers
```

Example A:

```text
Customer 1: 80%
Customer 2: 10%
Customer 3: 10%

HHI =
0.80² + 0.10² + 0.10²
= 0.66
```

Example B:

```text
10 customers: 10% each

HHI =
10 × 0.10²
= 0.10
```

A higher HHI represents greater concentration risk.

### Conversion

The earlier draft used `C = max(0.4, 1 − HHI)`. That floor is generous in the wrong direction: a borrower with a single customer at 100% of revenue has `HHI = 1.0` and still receives `C = 0.40`. A single-customer service is not a 60% haircut — it is one email away from zero revenue.

The floor is removed:

```text
C = 1 − HHI
```

```text
HHI = 0.66  →  C = 0.34
HHI = 0.10  →  C = 0.90
HHI = 1.00  →  C = 0.00
```

`Q_min` still prevents `C` alone from driving the limit to zero, but a concentrated borrower now takes the full weighted penalty.

### Hard concentration ceiling

The factor is a haircut, not a gate. A gate is also required:

```text
No single payer may account for more than 40% of eligible
30-day revenue for any limit above the new-borrower cap.

Above 40%:  limit is capped at L_new_borrower
Above 60%:  borrower cannot exceed WATCH-tier limits
Above 80%:  no new draws
```

### Upstream concentration

Concentration is measured on the revenue side, but a machine business also carries concentration on the cost side. A service whose entire cost base is one model provider or one GPU marketplace fails if that provider changes pricing or availability.

The MVP records declared upstream dependencies for reporting. Production versions should apply a separate haircut for upstream concentration, and the risk console should surface protocol-wide exposure to any single upstream provider, since a correlated shock across many borrowers is a portfolio event rather than a borrower event.

## 13.8 Revenue-volatility factor

Use the coefficient of variation:

```text
CV = σ_R / μ_R

σ_R   standard deviation of daily eligible revenue
μ_R   mean daily eligible revenue
```

Suggested mapping:

| Revenue CV | Volatility factor |
| ---------: | ----------------: |
|     0–0.20 |              1.00 |
|  0.20–0.40 |              0.90 |
|  0.40–0.60 |              0.75 |
|  0.60–1.00 |              0.60 |
| Above 1.00 |              0.40 |

## 13.9 Revenue-growth factor

Growth should increase limits conservatively and reduce them decisively. The mapping is deliberately asymmetric: upside is capped at a 10% uplift, while a collapse is treated as close to an existential signal rather than a haircut.

| 30-day revenue growth | Growth factor | Additional action |
| --------------------: | ------------: | --- |
|            Below −40% |          0.25 | Move to WATCH |
|          −40% to −25% |          0.45 | Move to WATCH |
|          −25% to −10% |          0.70 | Block limit increases |
|          −10% to +10% |          1.00 | — |
|          +10% to +30% |          1.05 | — |
|            Above +30% |          1.10 | Growth cap applies; verify payer set is not newly created |

A 40% month-over-month revenue decline in an autonomous service is not a soft signal. There is no payroll to cut, no seasonality to wait out and no management team responding to it. Revenue is the entire asset, and the appropriate protocol response is to reduce exposure before the borrower defaults, not after.

Rapid growth does not produce unlimited credit expansion. Growth above +30% is uplifted by at most 10%, the per-assessment growth cap still applies, and revenue from payers first observed inside the growth window is subject to the new-payer contribution cap in the anti-manipulation controls.

## 13.10 Operating-capacity factor

The protocol should consider whether the borrower retains enough revenue to service debt after operating expenses.

```text
M = min( 1 , estimated operating cash flow / required repayment coverage )
```

### The self-reporting problem

The earlier draft sourced this factor from a "configured cost-per-request supplied by the provider". A borrower that declares a cost-per-request of zero reports infinite margin and receives `M = 1`. The factor as specified rewards dishonesty.

### Protocol cost bands

Declared costs are accepted only within a protocol-maintained band for the borrower's service category.

| Service category | Plausible cost-per-request band |
| --- | --- |
| Text generation and inference proxy | 40% – 85% of price |
| Embedding and vector services | 20% – 60% of price |
| Search, retrieval and enrichment | 30% – 75% of price |
| Document and media processing | 35% – 80% of price |
| Data lookup and static datasets | 10% – 50% of price |

```text
declared_cost < band_floor   →  band_floor is used, and M is capped at 0.85
declared_cost within band    →  declared value is used
declared_cost > band_ceiling →  declared value is used (conservative direction)
category not declared        →  worst band across all categories is applied
```

### Verified-expense uplift

A borrower may raise `M` above the unverified ceiling by routing its operating expenses through Rivora-observable payment rails. If the borrower's own upstream purchases are made through x402 or agent-wallet transfers Rivora can observe, cost per request becomes measured rather than declared.

```text
Unverified declared costs   →  M capped at 0.85
Partially observed costs    →  M capped at 0.95
Fully observed cost base    →  M uncapped
```

This creates a deliberate incentive loop: the borrower that lets Rivora observe both sides of its ledger gets a better limit, and Rivora gains the expense data that makes production underwriting possible.

## 13.11 Worked example

### Inputs

```text
Normalized eligible 30-day revenue:  10,000 USDC
Borrower tier:                       Strong (score 79)
Base advance rate A:                     0.30
Custody model:                       A (router is settlement destination)
Repayment share:                          20%
Maximum horizon (Strong):             60 days
Previous approved limit:              2,100 USDC
Total vault assets:                 100,000 USDC

Service reliability      S = 0.90
Customer concentration   C = 0.80
Revenue volatility       V = 0.90
Revenue diversity        D = 0.85
Operating capacity       M = 0.90
Revenue growth           G = 1.05
```

### Quality factor

```text
Q = 1 − [ 0.30(0.10) + 0.25(0.20) + 0.15(0.10)
        + 0.15(0.15) + 0.15(0.10) ]

  = 1 − [ 0.0300 + 0.0500 + 0.0150 + 0.0225 + 0.0150 ]

  = 1 − 0.1325

Q = 0.8675
```

Read directly: the borrower carries a 13.25% quality haircut, of which concentration contributes 5.00 points — the largest single component and therefore the first thing the explanation should name.

### Quality-derived limit

```text
L_quality = 10,000 × 0.30 × 0.8675 × 1.05

L_quality = 2,733 USDC
```

### Constraints

```text
L_horizon          = 10,000 × 0.20 × (60/30)      =  4,000 USDC
L_horizon_stressed = (10,000 × 0.70) × 0.20 × 3   =  4,200 USDC
L_custody          = no reduction under Model A   =  4,000 USDC
L_exposure         = 5% × 100,000                 =  5,000 USDC
L_previous × 1.50  = 2,100 × 1.50                 =  3,150 USDC
```

### Result

```text
L = min( 2,733 , 4,000 , 4,200 , 5,000 , 3,150 )

Approved credit limit = 2,730 USDC
```

```text
Binding constraint:      quality factor
Effective advance rate:  27.3% of normalized monthly revenue
Projected payback:       41 days at current revenue and 20% routing
Projected payback (stressed, −30% revenue):   58 days
```

### Comparison with the multiplicative draft

The earlier multiplicative form produced 1,561 USDC from the same inputs — an effective advance rate of 15.6% against a stated 30%. The stated rate was therefore misleading by roughly a factor of two, and the discrepancy grew with the number of factors.

Under the additive-penalty form the stated advance rate is approximately honest, the haircut is attributable to named factors, and the deviation from the stated rate is exactly the quality penalty the borrower can read off the explanation.

---

# 14. Risk Score and Tiering

## 14.1 One pipeline, not two

The earlier draft computed the credit limit and the risk score independently from overlapping but differently weighted signals, with nothing reconciling them. That permits a borrower to be scored Prime while receiving a limit crushed by a factor the score barely weights — with no explanation available for the contradiction.

The score is therefore made primary and the limit is derived from it:

```text
Observed signals
      │
      ▼
Risk score  (0–100)          ← single weighted assessment of the borrower
      │
      ▼
Borrower tier                ← score bands
      │
      ├──► Base advance rate  A(tier)
      ├──► Risk premium       p_b(tier)
      ├──► Maximum horizon    T_max(tier)
      └──► Tier limit cap
      │
      ▼
Quality factor Q             ← modulates within the tier
      │
      ▼
Credit limit L               ← min of quality limit and hard constraints
```

The score answers *what kind of borrower is this*. The quality factor answers *how much of that tier's capacity has this borrower earned*. They use the same underlying signals but serve distinct roles, and neither can silently contradict the other.

## 14.2 Score range

```text
90–100  Prime
75–89   Strong
60–74   Standard
40–59   Restricted
0–39    Ineligible
```

## 14.3 Score weighting

| Signal | Weight | Source |
| --- | ---: | --- |
| Service reliability | 20% | Protocol-observed, per 13.5 |
| Revenue consistency | 18% | Inverse coefficient of variation over 60 days |
| Repayment history | 15% | Completed repayment cycles, on-time ratio, prior delinquency |
| Customer concentration | 13% | HHI, per 13.7 |
| Customer diversity | 10% | Unique and repeat eligible payers, per 13.6 |
| Revenue custody strength | 8% | Custody model in force, per 11.3 |
| Operating history | 6% | Days since first eligible revenue, endpoint age |
| Revenue growth | 5% | Trailing growth, per 13.9 |
| Reserve coverage | 5% | Reserve balance against outstanding principal |

Custody strength is scored rather than assumed. A borrower whose revenue provably cannot be diverted is a fundamentally different credit from one whose revenue merely has not been diverted yet.

## 14.4 Tier parameters

| Tier | Score | Base advance A | Risk premium | Max horizon | Tier limit cap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Prime | 90–100 | 35% | 1% | 60 days | 100,000 USDC |
| Strong | 75–89 | 30% | 3% | 60 days | 50,000 USDC |
| Standard | 60–74 | 20% | 6% | 45 days | 25,000 USDC |
| Restricted | 40–59 | 0% | 12% | — | No new draws |
| Ineligible | 0–39 | 0% | — | — | No borrowing |

Every advance rate above satisfies the horizon derivation in 13.4 at the default 20% repayment share:

```text
Prime     0.20 × (60/30) = 0.40 ≥ 0.35   ✓
Strong    0.20 × (60/30) = 0.40 ≥ 0.30   ✓
Standard  0.20 × (45/30) = 0.30 ≥ 0.20   ✓
```

The tier table cannot be edited independently of the repayment share. If governance reduces the routed repayment percentage, every advance rate must be recomputed or the horizon constraint will begin binding silently on every borrower.

## 14.5 Explainable decision

Every risk decision must produce human-readable reasons, and the reasons must be generated from the factor arithmetic rather than narrated separately. Each limiting factor names its contribution to the quality haircut, and the binding constraint is stated explicitly.

```text
Credit limit increased from 1,690 USDC to 2,530 USDC.
Risk score 68 → 78. Tier: Standard → Strong.

Positive factors:
+ Normalized 30-day eligible revenue increased 35% (10,000 → 13,500 USDC).
+ Settlement success ratio improved from 88% to 96%.
+ Repeat payers increased from 95 to 168.
+ Largest payer share fell from 22% to 14%.
+ Tier advance rate increased from 20% to 30%.

Limiting factors (contribution to the 9.1% quality haircut):
- Customer concentration            3.5 points
- Operating capacity, costs unverified  1.8 points
- Revenue volatility                1.5 points
- Service reliability               1.5 points
- Customer diversity                0.8 points

Binding constraint:
  Per-assessment growth cap (1,690 × 1.50 = 2,535).
  Quality-derived limit was 4,051 USDC.
  A further increase is available at the next assessment
  if performance holds.
```

The final block is the part that matters operationally. A borrower told only "your limit is 2,530" will try to improve quality metrics that are not the constraint. A borrower told the growth cap is binding knows the correct action is to wait.

---

# 15. Interest-Rate Model

## 15.1 Vault utilization

```text
U = total outstanding principal
    ─────────────────────────────────────────────────────
    total available liquidity + total outstanding principal
```

Example:

```text
Available liquidity:       70,000 USDC
Outstanding principal:     30,000 USDC
Total vault assets:       100,000 USDC

Utilization = 30%
```

## 15.2 Kinked utilization curve

Rivora uses a utilization-based rate.

Below the target utilization, rates rise gradually. Above the target, rates rise more aggressively to:

* Discourage additional borrowing
* Encourage repayment
* Attract additional liquidity
* Preserve withdrawal liquidity

Example model:

```text
                ⎧  r₀ + s₁·U                          , U ≤ U_k
        r(U) =  ⎨
                ⎩  r₀ + s₁·U_k + s₂·(U − U_k)         , U > U_k

r₀    base annual rate
s₁    low-utilization slope
s₂    high-utilization slope
U_k   utilization kink
```

Example parameters:

```text
Base rate       r₀  =  5%
Kink            U_k = 80%
Low slope       s₁  =  8%
High slope      s₂  = 80%
```

Therefore:

```text
                ⎧   5% +  8%·U                        , U ≤ 0.80
        r(U) =  ⎨
                ⎩  11.4% + 80%·(U − 0.80)             , U > 0.80
```

```text
U = 0.30  →  r =  7.4%
U = 0.60  →  r =  9.8%
U = 0.80  →  r = 11.4%
U = 0.90  →  r = 19.4%
U = 0.95  →  r = 23.4%
```

## 15.3 Borrower risk premium

The final borrower rate is the utilization rate plus a tier risk premium:

```text
r_b = r(U) + p_b
```

Example:

| Borrower tier | Risk premium |
| ------------- | -----------: |
| Prime         |           1% |
| Strong        |           3% |
| Standard      |           6% |
| Restricted    |          12% |
| Ineligible    | No borrowing |

## 15.4 Interest accrual

Nominal accrual:

```text
I = P × r_annual × ( t / 365 days )
```

### Implementation: index-based, not per-borrower loops

Accruing per borrower per second by iteration does not scale and loses precision. Rivora uses a global borrow index in the manner of established lending protocols.

```text
borrowIndex(t) = borrowIndex(t₋₁) × ( 1 + r(U) × Δt / SECONDS_PER_YEAR )

Borrower principal is stored as a normalized amount:

    normalizedDebt = actualDebt / borrowIndex(at time of draw)

Actual debt at any time is recovered as:

    actualDebt = normalizedDebt × borrowIndex(now)
```

The index is updated once per interaction with the vault, not per borrower and not per block. Borrower-specific risk premiums are carried as a per-borrower premium index updated on the same schedule.

Precision requirements:

```text
Index precision:       1e27 (ray)
USDC precision:        1e6
Rounding direction:    always against the borrower on debt,
                       always against the protocol on repayment credit
```

Rounding direction must be stated in the contract and tested. Consistently rounding in the protocol's favour on both sides silently accrues dust to the vault; consistently rounding in the borrower's favour leaks it.

## 15.5 Negative-amortization guard

Section 12.2 of the revenue waterfall allocates a fixed share of revenue to repayment, and repayment applies to accrued interest before principal. If interest accrues faster than the repayment allocation covers it, the debt grows despite the borrower paying continuously, and the loan never terminates. Nothing in the earlier draft prevented this.

### Interest coverage

```text
Daily interest accrual   = P × r_b / 365

Daily repayment capacity = R_daily_eligible × repaymentBps / 10,000

Interest coverage ratio  = daily repayment capacity / daily interest accrual
```

### Thresholds

| Coverage | State | Action |
| ---: | --- | --- |
| ≥ 3.0 | Healthy | Draw permitted |
| 1.5 – 3.0 | Thin | Draw permitted only if post-draw coverage ≥ 3.0 |
| 1.0 – 1.5 | Impaired | WATCH. New draws blocked. Repayment share escalates by 5 points |
| < 1.0 for 3 consecutive days | Negatively amortizing | RESTRICTED. Repayment share escalates to the delinquency rate |
| < 1.0 for 7 consecutive days | Structural | DELINQUENT. Reserve is applied to accrued interest |

**Coverage ≥ 3.0 is a hard precondition on every draw**, evaluated in the Credit Manager rather than offchain.

### Why the threshold sits where it does

Under default parameters, coverage at full utilization is:

```text
coverage = ( repaymentBps / A ) × ( 365 / 30 ) / r_b

with repaymentBps = 20%, A = 30%, r_b = 15.8%:

coverage = 0.667 × 12.17 / 0.158 ≈ 51
```

Negative amortization from the interest rate alone would require a borrower rate above roughly 800% — it is not reachable. The real failure path is revenue collapse against unchanged principal: coverage scales linearly with revenue, so it takes an approximately 98% revenue decline to drive coverage below 1.

That is precisely the condition the protocol most needs to detect, and it is exactly the condition that a revenue-share repayment mechanism hides — because a borrower earning almost nothing is still "repaying on schedule" as a percentage. The coverage ratio is the tripwire that distinguishes proportional repayment from no repayment.

## 15.6 Interest during batch settlement lag

Interest accrues between authorization and settlement, but repayment can only be applied at settlement. The coverage calculation must therefore use settled revenue velocity, not authorized revenue velocity.

```text
R_daily_eligible for coverage purposes =
    trailing 14-day mean of settled router inflows

not

    trailing 14-day mean of authorized payments
```

Using authorized revenue would overstate repayment capacity by exactly the settlement lag, which is the period during which a failing borrower is least able to pay.

---

# 16. Borrower Lifecycle

## 16.1 Stage 1: registration

The provider:

1. Connects a wallet.
2. Creates a Rivora service profile.
3. Registers its x402 endpoint.
4. Deploys or links a Revenue Router.
5. Provides expected cost-per-request.
6. Selects an operating wallet.
7. Accepts protocol terms.

## 16.2 Stage 2: observation

Rivora observes revenue before extending meaningful credit.

Suggested production minimums:

* At least 30 days of revenue history
* At least 100 eligible paid requests
* At least 10 independent customers
* At least 90% successful service fulfilment

The hackathon MVP can simulate a shorter period.

## 16.3 Stage 3: initial credit approval

The underwriting agent:

1. Aggregates revenue.
2. Removes ineligible payments.
3. Calculates risk factors.
4. Calculates a proposed credit limit.
5. Generates an explanation.
6. Signs the decision.
7. Submits it to the Credit Manager.
8. Credit Manager validates protocol bounds.
9. Credit limit becomes active.

## 16.4 Stage 4: borrowing

The borrower submits:

```text
Requested amount
Use-of-funds category
Destination wallet
Expected repayment period
```

The protocol verifies:

* Credit line is active.
* Requested amount is within available credit.
* Vault has sufficient liquidity.
* Borrower is not restricted.
* Destination is allowed.
* Spending policy is satisfied.
* Revenue Router remains active.

## 16.5 Stage 5: automatic repayment

Future revenue enters the Revenue Router and repays:

1. Accrued interest
2. Outstanding principal
3. Borrower reserve
4. Borrower operating wallet

## 16.6 Stage 6: credit-line adjustment

The agent periodically recalculates limits.

Suggested cadence:

* Every 24 hours
* After a material revenue change
* After a default-warning trigger
* After a large refund
* After suspicious activity
* After complete repayment

## 16.7 Stage 7: closure

The borrower may close its account when:

* Outstanding debt equals zero.
* Pending repayments equal zero.
* No active dispute exists.
* Required reserve-release period has passed.

---

# 17. Credit-State Machine

```text
OBSERVATION
    │
    ▼
ELIGIBLE
    │
    ▼
ACTIVE
    │
    ├──────────────► WATCH
    │                  │
    │                  ▼
    │              RESTRICTED
    │                  │
    │                  ▼
    │              DELINQUENT
    │                  │
    │                  ▼
    └──────────────► DEFAULTED

ACTIVE ─────────────► REPAID
REPAID ─────────────► ACTIVE
```

## 17.1 Observation

Borrower is accumulating sufficient history.

Cannot borrow.

## 17.2 Eligible

Borrower has received an initial credit limit but has no debt.

## 17.3 Active

Borrower has an active credit line and may borrow.

## 17.4 Watch

Triggered when:

* Revenue drops materially.
* Failure rate increases.
* Customer concentration increases.
* Reserve coverage declines.
* Suspicious payment activity appears.

Borrowing may continue at a reduced limit.

## 17.5 Restricted

No new borrowing is allowed.

Revenue continues to repay existing debt.

## 17.6 Delinquent

Expected revenue repayment has fallen below a defined threshold.

Actions:

* Increase repayment percentage.
* Freeze non-essential spending.
* Route reserve toward repayment.
* Notify protocol risk operators.
* Block new draws.

## 17.7 Defaulted

The borrower cannot reasonably repay under existing terms.

Default waterfall begins.

---

# 18. Default and Loss Management

## 18.1 Default triggers

Possible triggers include:

* No eligible revenue for a defined period
* Revenue Router intentionally disabled
* Fraudulent revenue detected
* Debt exceeds revised maximum exposure
* Borrower violates wallet restrictions
* Service endpoint remains unavailable
* Required reserve is exhausted
* Delinquency persists beyond the grace period

## 18.2 Default waterfall

```text
1. Accrued borrower repayments
2. Borrower-specific loss reserve
3. Borrower security bond, where applicable
4. Protocol-wide reserve
5. Junior liquidity-provider tranche
6. Senior liquidity-provider tranche
```

For the hackathon MVP, Rivora should implement only:

```text
Borrower reserve
      ↓
Protocol loss reserve
      ↓
Liquidity-provider loss
```

## 18.3 Recovery mode

When a borrower enters recovery:

* Revenue repayment percentage may increase.
* Credit line becomes zero.
* Operating withdrawals may be limited.
* Existing revenue continues servicing debt.
* The service may exit recovery after satisfying defined conditions.

## 18.4 Partial recovery

Default should not necessarily terminate the service permanently.

An operating service may repay debt gradually from future revenue.

---

# 19. Reputation and Enforcement

## 19.1 The enforcement problem

Once a borrower has drawn funds, its credit line is zero and its endpoint is under its own control, nothing physically compels it to keep routing revenue through Rivora. The earlier draft stated that a defaulted service "may repay debt gradually from future revenue" without identifying why it would.

Rivora has no collateral to seize, no bank account to garnish and, for a pseudonymous or agent-operated borrower, frequently no counterparty to sue. Reputation is therefore not a nice-to-have feature. **It is the entire security model**, and it must be engineered with the same seriousness a collateralized protocol applies to liquidation.

## 19.2 What makes machine reputation costly to abandon

A borrower can always walk away by abandoning its identity. Rivora's job is to make that expensive.

| Asset lost on abandonment | Why it is costly | How Rivora binds it |
| --- | --- | --- |
| Accumulated credit capacity | Rebuilt only through another full observation and seasoning period | Limit is a function of history length, not just current revenue |
| Endpoint domain and customer relationships | Existing customers have the old URL and payment configuration hard-coded into their agents and integrations | Reputation is bound to the endpoint identity, not only the wallet |
| Repeat-customer base | Retention is a scored factor and resets to zero on a new identity | Retention weighted in both the score and the reliability factor |
| Marketplace listings and rankings | Agent and API marketplaces list by identity | Portable attestations consumed by marketplace partners |
| Posted security bond | Directly forfeited | Bond required for higher tiers and weaker custody models |

The economic test is simple: **the cost of abandoning the identity must exceed the outstanding principal.** Where it does not, the limit is too high. This is the reason the new-borrower cap exists and the reason limits step up slowly rather than tracking revenue immediately.

## 19.3 Machine credit identity

```text
borrowerId = keccak256(
    ownerWallet,
    endpointDomain,
    routerAddress
)
```

Identity is bound to all three. Changing any one produces a new identity with no history, which is the intended cost. A legitimate migration — a domain change, a router upgrade, an ownership transfer — is supported through an explicit succession request that carries history forward only if the outstanding debt is zero or the new identity assumes it.

## 19.4 Default registry

Defaults are recorded onchain, permanently, and are queryable by any third party.

```solidity
struct DefaultRecord {
    bytes32 borrowerId;
    uint256 principalAtDefault;
    uint256 amountRecovered;
    uint256 defaultedAt;
    uint256 curedAt;          // 0 if uncured
    bytes32 evidenceHash;
}
```

The record is never deleted. It may be **cured** but not erased. A cured default remains visible with its cure date, in the same way a settled delinquency remains on a conventional credit file.

Recording is deliberately blunt because the registry's value to third parties depends entirely on it being non-negotiable. A registry the operator can be persuaded to clear is worth nothing to the marketplace consuming it.

## 19.5 Cure path

Default should not permanently terminate an operating service. A borrower that keeps earning is worth more to the protocol repaying slowly than written off.

```text
Entry to cure:
    Borrower re-binds a revenue router
    Repayment share is set to the recovery rate (default 50%)
    Credit limit remains zero

During cure:
    All routed revenue services outstanding debt
    Reliability probes continue
    Progress is publicly visible

Exit from cure:
    Outstanding principal and accrued interest reach zero
    OR a protocol-approved settlement is paid in full
    AND 30 days of continued routed revenue follow

After cure:
    Borrower re-enters at Restricted tier
    Default record persists with curedAt set
    Advance rate capped at 50% of tier base for 180 days
```

## 19.6 Portable attestations

Repayment history is only valuable as collateral if it is worth something outside Rivora. The protocol therefore issues signed, verifiable attestations that other credit providers, marketplaces and counterparties can consume.

```text
GET /v1/reputation/:borrowerId

{
  "borrowerId":            "0x…",
  "tier":                  "Strong",
  "score":                 78,
  "monthsObserved":        14,
  "cyclesCompleted":       9,
  "principalRepaid":       "184200.00",
  "onTimeRatio":           0.98,
  "defaultsRecorded":      0,
  "custodyModel":          "A",
  "attestedAt":            "…",
  "signature":             "0x…"
}
```

Deliberately absent: revenue figures, payer identities, concentration detail, endpoint traffic. The attestation conveys creditworthiness without disclosing the commercially sensitive data underneath it. See the privacy section.

## 19.7 Enforcement beyond reputation

Reputation is the primary mechanism, not the only one. In descending order of applicability:

1. **Security bond.** Required above defined limits and mandatory under weaker custody models. Directly forfeitable.
2. **Loss reserve.** Accrued from the borrower's own revenue and applied first in the default waterfall.
3. **Router-structural repayment.** Under custody Model A, repayment is not an action the borrower takes.
4. **KYB-backed recourse.** For the permissioned launch cohort, a known legal operator provides conventional recourse. This is why the recommended strategy starts permissioned.
5. **Marketplace exclusion.** Partner marketplaces may delist borrowers with uncured defaults, under agreements negotiated as part of the delegation product.

## 19.8 Who may declare a default

Default declaration must not be a discretionary human action, because a discretionary action is one that can be lobbied, delayed or disputed.

```text
Automatic, contract-enforced triggers:
    Coverage ratio below diversion threshold for 14 days
    Endpoint binding broken and uncured for 7 days
    Interest coverage below 1.0 for 7 days
    No routed revenue for 21 days with outstanding principal

Risk-operator declaration (requires two-of-N multisig
and a published evidence hash):
    Confirmed fraudulent revenue
    Confirmed wallet-policy violation
    Confirmed identity misrepresentation
```

Automatic triggers do not require a human. Human declaration requires quorum and published evidence. Neither path allows a single operator to default a borrower unilaterally.

---

# 20. Anti-Manipulation Controls

## 20.1 Wash-revenue risk

A borrower could send USDC to related wallets and use those wallets to pay its own API.

Mitigations:

* Detect circular fund flows.
* Identify common funding sources.
* Exclude transactions from related wallets.
* Apply customer-age requirements.
* Limit credit derived from new wallets.
* Require proof of successful service fulfilment.
* Delay revenue eligibility.
* Calculate net economic revenue after refunds and incentives.

## 20.2 Fake-customer diversification

A borrower could create many wallets to appear diversified.

Mitigations:

* Wallet clustering
* Funding-source analysis
* Payer-age weighting
* Payment-pattern similarity analysis
* Behaviour-based entity detection
* Minimum customer retention
* Caps on newly observed payer contribution

## 20.3 Temporary revenue inflation

A borrower could create a short burst of revenue before applying for credit.

Mitigations:

* Time-weighted revenue
* Median daily revenue
* Longer observation periods
* Growth caps
* Revenue-aging requirements
* Credit increases distributed over time

## 20.4 Service-quality manipulation

A provider may report successful requests that delivered unusable results.

Mitigations:

* Customer-signed fulfilment confirmation
* Refund monitoring
* Verifier-agent attestations
* Deterministic API health checks
* Response-quality sampling
* Repeat-customer retention signals

## 20.5 Revenue diversion

A borrower may direct future customers to a different wallet after borrowing.

Mitigations:

* Credit only revenue endpoints using the registered router.
* Bind approved x402 endpoints to the router.
* Reduce credit when routed revenue declines unexpectedly.
* Require a security reserve.
* Restrict credit to a fraction of historical revenue.
* Apply contractual or governance enforcement in production deployments.

---

# 21. Borrower Privacy and Data Disclosure

## 21.1 Why this is an adoption blocker, not a compliance footnote

Rivora asks a business to route its revenue through a public blockchain and submit its customer data for underwriting. For an AI API, that data is the business: pricing, request volume, customer count, concentration and growth trajectory are exactly what a competitor would pay for.

A protocol that publishes an API provider's customer concentration onchain has told its competitors which customer to poach. No serious operator onboards under those terms. Privacy design is therefore a precondition for the borrower side of the marketplace existing at all.

## 21.2 Disclosure tiers

| Data | Onchain | Liquidity providers | Risk operators | Public API | Rivora internal |
| --- | --- | --- | --- | --- | --- |
| Borrower pseudonymous ID | Yes | Yes | Yes | Yes | Yes |
| Legal identity / KYB record | No | No | Named operators only | No | Yes |
| Risk score and tier | Yes | Yes | Yes | Yes | Yes |
| Credit limit, principal, interest | Yes | Aggregate only | Yes | No | Yes |
| Factor values | Bucketed bands | Bucketed bands | Exact | Bucketed bands | Exact |
| Absolute revenue figures | No | Portfolio aggregate only | Yes | No | Yes |
| Individual payer addresses | Never | Never | Aggregated clusters only | Never | Yes |
| Per-customer revenue split | Never | Never | Bucketed | Never | Yes |
| Endpoint URL | Hashed | No | Yes | No | Yes |
| Decision explanation | Hash only | Borrower-authorized only | Yes | No | Yes |

## 21.3 Bucketed factor disclosure

Exact factor values leak the underlying data. A published HHI of 0.284 combined with a published payer count is close to a full revenue breakdown. Onchain and LP-facing factors are therefore published as bands.

```text
Concentration band:   LOW | MODERATE | ELEVATED | HIGH | CRITICAL
Diversity band:       band index 1–5, not payer count
Volatility band:      band index 1–5, not coefficient of variation
Reliability band:     one decimal place only
```

The exact values remain in the offchain assessment record and are committed to by the `evidenceHash`, so the computation stays auditable and reproducible without being public.

## 21.4 The router-throughput problem

One disclosure cannot be designed away: the Revenue Router is an onchain contract, so **its total throughput is publicly observable**. Anyone can read a borrower's gross revenue by watching the router.

This is inherent to structural repayment. Stated honestly:

* **What leaks:** aggregate revenue volume and timing per borrower.
* **What does not leak:** payer identity, per-customer split, pricing, request counts, customer names.
* **Partial mitigation:** nanopayment batching already aggregates many payments into net settlements, so per-request and per-payer granularity is destroyed before the funds reach the router.
* **Further mitigation:** a shared router serving multiple borrowers with internal accounting obscures per-borrower throughput at the cost of contract complexity and per-borrower isolation. Deferred beyond MVP.

Borrowers must be told this plainly at onboarding. A borrower that discovers it after routing six months of revenue is a borrower lost, and the disclosure costs nothing when made up front.

## 21.5 Liquidity-provider disclosure

Liquidity providers need enough information to assess risk, not enough to reconstruct any borrower's business.

```text
Provided to LPs:
    Portfolio-level revenue coverage of outstanding principal
    Tier distribution of the loan book
    Sector distribution
    Custody-model distribution
    Utilization, reserve coverage, realized losses
    Concentration of the loan book by borrower size band
    Historical default and recovery rates by tier

Not provided to LPs:
    Any individual borrower's revenue
    Any individual borrower's customers
    Any borrower's identity beyond its pseudonymous ID
```

This mirrors how a credit fund reports to its investors: portfolio composition and performance, not the underlying obligors' books.

## 21.6 Underwriting on private data

The long-term direction is to prove factor computation without disclosing inputs.

```text
Today:      Rivora computes factors from raw data it holds,
            publishes evidenceHash, signs the assessment.
            Trust model: trust the underwriter, verify the commitment.

Next:       Borrower-held data with selective disclosure to the
            underwriter under a data-processing agreement.

Target:     Zero-knowledge proof that the published factors were
            correctly computed from data committed to by
            evidenceHash, without revealing the data.
```

The `evidenceHash` and `modelVersion` fields already in the assessment structure are the forward-compatible foundation for this: they commit to the inputs and the computation today, and become the public inputs to a proof later.

## 21.7 Data-handling requirements

* Raw payment data is retained only as long as needed for the trailing assessment window plus the audit-retention period.
* Payer addresses are stored salted-hashed in analytics stores; the plaintext mapping lives in a single access-controlled store.
* Borrower data is deleted on account closure except for the fields required by the default registry and audit obligations, which are disclosed at onboarding.
* No borrower's data may be used to train or tune a model serving another borrower's underwriting without explicit consent.
* Decision explanations are the borrower's data. Rivora does not publish them; the borrower may.

---

# 22. Functional Requirements

## 22.1 Borrower onboarding

### Requirements

* Connect Circle Wallet or compatible EVM wallet.
* Create service profile.
* Register service name and category.
* Register x402 endpoint.
* Register revenue wallet.
* Deploy or connect Revenue Router.
* Configure borrower operating wallet.
* Display onboarding status.
* Validate Arc Testnet balances.

### Acceptance criteria

* Provider can complete onboarding in under ten minutes.
* Endpoint ownership can be verified.
* Revenue Router address is recorded onchain.
* Provider cannot borrow before approval.

---

## 22.2 Revenue analytics

### Requirements

Display:

* Gross revenue
* Eligible revenue
* Excluded revenue
* Revenue by day
* Successful requests
* Failed requests
* Refunds
* Unique customers
* Repeat customers
* Customer concentration
* Average payment size
* Revenue volatility
* Growth rate

### Acceptance criteria

* Dashboard updates after a payment event.
* Excluded revenue includes a reason.
* Revenue calculations can be reproduced from stored events.

---

## 22.3 Credit assessment

### Requirements

* Trigger automated risk assessment.
* Calculate each underwriting factor.
* Produce risk score.
* Produce recommended limit.
* Explain positive and negative factors.
* Submit signed recommendation.
* Store approved limit onchain.
* Maintain assessment history.

### Acceptance criteria

* Limit calculation is deterministic for the same input set.
* Smart contract rejects limits above protocol caps.
* User can view why the limit changed.

---

## 22.4 Borrowing

### Requirements

* Display total credit limit.
* Display outstanding debt.
* Display available credit.
* Allow borrower to request a USDC draw.
* Validate destination wallet.
* Display interest rate.
* Show estimated repayment.
* Require approval for restricted expense categories.
* Emit onchain draw event.

### Acceptance criteria

* Borrower cannot exceed available credit.
* Draw fails when vault liquidity is insufficient.
* Debt balance updates immediately after settlement.
* Transaction is visible in the activity feed.

---

## 22.5 Repayment

### Requirements

* Automatically route incoming revenue.
* Apply repayment to interest first.
* Apply remaining amount to principal.
* Update reserve.
* Transfer operating portion.
* Support direct manual repayment.
* Emit repayment events.

### Acceptance criteria

* Total distributed amount equals revenue received.
* No amount can be distributed twice.
* Excess repayment returns to borrower.
* Fully repaid loans update borrower state.

---

## 22.6 Liquidity-provider vault

### Requirements

* Deposit USDC.
* Receive vault shares.
* View supplied liquidity.
* View utilization.
* View estimated annualized yield.
* View borrower exposure.
* Request withdrawal.
* Claim available withdrawal.
* View withdrawal-queue position and estimated availability.
* View the current withdrawal fee, if any.
* Track realized losses.

### Acceptance criteria

* Vault shares reflect proportional ownership.
* Interest increases vault share value.
* Instant withdrawals cannot draw the liquidity buffer below its floor.
* Queued withdrawals are served in strict order and show an estimated date.
* Deposits and withdrawals emit events.

Withdrawal mechanics are specified in full in the vault liquidity management section.

---

## 22.7 Risk monitoring

### Requirements

* Recalculate borrower risk periodically.
* Detect material revenue decline.
* Detect increased failure rate.
* Detect concentration changes.
* Detect suspicious payer patterns.
* Reduce credit limit.
* Freeze new draws.
* Increase repayment percentage.
* Notify borrower and operators.

---

## 22.8 Agent spending controls

Borrowed funds should be subject to policy restrictions.

Example policies:

```text
Maximum individual payment:     100 USDC
Maximum daily spending:         500 USDC
Allowed recipients:             approved service list
Allowed categories:             compute, data, storage
Blocked contracts:              unapproved DeFi protocols
Human approval threshold:       250 USDC
```

Circle Agent Wallets expose policy-based controls for agent wallet activity and integrate with machine-to-machine x402 payments.

---

# 23. Vault Liquidity Management

## 23.1 The run problem

"Withdrawals cannot exceed liquid assets" is a constraint, not a design. At 85% utilization it produces a race: the first liquidity providers to notice a deteriorating loan book withdraw the remaining liquidity, and the rest are left holding the impaired book. Rational anticipation of that race triggers it before any actual impairment occurs.

Every credit vault needs an explicit answer. Rivora's has three parts: a protected buffer, an ordered queue and a fee that makes exiting into stress costly.

## 23.2 Natural liquidity return

Rivora has a structural advantage that most credit vaults lack: the loan book amortizes continuously rather than at maturity.

```text
Daily principal return = outstanding principal × ( repaymentBps / 10,000 )
                                                × ( 30 / T_payback_at_full_utilization )

At A = 30%, repaymentBps = 20%:

    daily return ≈ 2.2% of outstanding principal

    50% of the book returns in ~23 days
    90% of the book returns in ~41 days
```

Liquidity therefore returns without any borrower action, without liquidations and without a maturity date. This is the single most important property to communicate to liquidity providers, and it is why an epoch-based queue is workable here where it would not be for a term-loan book.

## 23.3 Minimum liquidity buffer

```text
Liquidity buffer floor = 15% of total vault assets
Maximum utilization    = 85%
```

Enforced in `RivoraCreditVault`:

* `fundDraw` reverts if it would take available liquidity below the buffer floor.
* The floor is checked against total vault assets at the time of the draw, not a cached value.
* Governance may raise the floor immediately; lowering it is subject to the upgrade governance delay.

The interest-rate kink at 80% sits deliberately below the 85% hard cap, so the rate curve discourages the last five points of utilization before the contract refuses them.

## 23.4 Withdrawal path

```text
LP requests withdrawal of X
      │
      ├── X ≤ (available liquidity − buffer floor)
      │        → served immediately
      │        → withdrawal fee applies if U > 80%
      │
      └── X > (available liquidity − buffer floor)
               → enters the withdrawal queue
               → shares are locked and stop accruing new interest
                 at the point of queue entry
               → funded from incoming repayments in FIFO order
               → claimable when fully funded
```

### Queue rules

```text
Epoch length:              24 hours
Ordering:                  strict FIFO by request timestamp
Partial funding:           permitted; partial claims permitted
Repayment allocation:      queued withdrawals are funded before
                           new draws are approved
Cancellation:              permitted at any time before claim,
                           returns shares and resumes accrual
Estimated availability:    published per position, computed from
                           the trailing 7-day repayment rate
```

Funding the queue ahead of new draws is the critical rule. Without it, repayments recycle into fresh loans and the queue never clears.

## 23.5 Withdrawal fee at high utilization

An exit fee removes the first-mover advantage that causes runs. It is paid to the liquidity providers who remain, so it also compensates them for the concentration they inherit.

```text
U ≤ 80%          fee = 0
80% < U ≤ 95%    fee = 1.0% × (U − 0.80) / 0.15
U > 95%          fee = 1.0%
```

```text
U = 0.80  →  0.00%
U = 0.85  →  0.33%
U = 0.90  →  0.67%
U = 0.95  →  1.00%
```

The fee is small by design. It is meant to remove the advantage of exiting first, not to trap capital. A fee large enough to genuinely lock liquidity providers in makes the vault shares harder to distinguish from a closed-end fund, with the accompanying securities questions.

## 23.6 Loss socialization

```text
Losses reduce the value of vault shares proportionally at the
moment they are realized.

Withdrawals queued at the time a loss is realized bear their
proportional share of that loss.
```

Queued liquidity providers cannot escape a loss by having queued before it was recognized. Without this rule, the queue itself becomes the run: sophisticated participants queue at the first sign of stress to exit at pre-loss share value.

## 23.7 Liquidity-provider yield floor during bootstrap

At low utilization, yield is near the base rate and liquidity providers have little reason to deposit. This is the cold-start problem in its vault form.

```text
Bootstrap period:        first 90 days of each new pool
Minimum LP yield:        6% annualized
Funded by:               protocol reserve
Cap:                     total subsidy capped per pool and
                         disclosed publicly before deposits open
Presentation:            shown as "protocol-subsidized" and
                         separated from organic yield in every
                         interface
```

The separation in presentation is not optional. Subsidized yield displayed as organic yield is a straightforward misrepresentation of returns, and the compliance section already prohibits representing simulated or guaranteed yield.

## 23.8 Vault monitoring thresholds

| Condition | Threshold | Action |
| --- | --- | --- |
| Utilization | > 85% | New draws blocked |
| Buffer | < 15% | New draws blocked |
| Withdrawal queue depth | > 20% of vault assets | New draws blocked; risk-console alert |
| Queue age | Oldest position > 14 days | Repayment share escalated protocol-wide |
| Reserve coverage | < 3% of outstanding principal | New draws restricted to Prime and Strong tiers |
| Single-borrower exposure | > 5% of vault assets | That borrower's limit frozen |
| Realized losses | > 2% of vault assets in 30 days | Lending paused pending risk review |

---

# 24. Smart Contract Architecture

## 24.1 MVP contracts

```text
RivoraCreditVault.sol
RivoraCreditManager.sol
RivoraRevenueRouter.sol
RivoraRiskRegistry.sol
```

## 24.2 RivoraCreditVault

### Responsibilities

* Accept liquidity-provider USDC
* Mint vault shares
* Process withdrawals
* Fund approved borrower draws
* Receive principal and interest
* Track total borrowed amount
* Track available liquidity
* Socialize realized losses
* Expose utilization rate

### Key functions

```solidity
deposit(uint256 assets, address receiver)

withdraw(
    uint256 assets,
    address receiver,
    address owner
)

fundDraw(
    bytes32 borrowerId,
    uint256 amount,
    address recipient
)

receiveRepayment(
    bytes32 borrowerId,
    uint256 principal,
    uint256 interest
)

recordLoss(
    bytes32 borrowerId,
    uint256 amount
)
```

## 24.3 RivoraCreditManager

### Responsibilities

* Maintain borrower credit limits
* Approve draw requests
* Calculate outstanding debt
* Accrue interest
* Manage borrower states
* Enforce protocol exposure limits
* Trigger restrictions
* Coordinate defaults

### Key borrower structure

```solidity
struct BorrowerAccount {
    address owner;
    address revenueRouter;
    address operatingWallet;
    uint256 creditLimit;
    uint256 principal;
    uint256 accruedInterest;
    uint256 repaymentBps;
    uint256 reserveBps;
    uint256 riskScore;
    BorrowerStatus status;
    uint256 lastAssessmentAt;
}
```

## 24.4 RivoraRevenueRouter

### Responsibilities

* Receive borrower revenue
* Split repayment, reserve and operating funds
* Send repayments to Credit Vault
* Maintain borrower reserve
* Support direct repayment
* Prevent unauthorized configuration changes

### Key function

```solidity
function distributeRevenue(uint256 amount) external;
```

### Distribution logic

```text
repaymentAmount =
amount × repaymentBps / 10,000

reserveAmount =
amount × reserveBps / 10,000

providerAmount =
amount − repaymentAmount − reserveAmount
```

## 24.5 RivoraRiskRegistry

### Responsibilities

* Store risk assessments
* Validate authorized underwriter signatures
* Store signal hashes
* Record credit-limit recommendations
* Maintain assessment history
* Prevent replayed assessments

### Assessment structure

```solidity
struct RiskAssessment {
    bytes32 borrowerId;
    uint256 riskScore;
    uint256 recommendedLimit;
    uint256 reliabilityFactor;
    uint256 diversityFactor;
    uint256 concentrationFactor;
    uint256 volatilityFactor;
    bytes32 evidenceHash;
    uint256 validUntil;
    uint256 nonce;
}
```

## 24.6 Production contract extensions

Future contracts:

```text
RivoraReserveVault.sol
RivoraInsurancePool.sol
RivoraTrancheVault.sol
RivoraGovernance.sol
RivoraReceivableToken.sol
RivoraDelegatedCredit.sol
```

## 24.7 Contract deployment

Rivora may deploy and interact with its contracts using Circle Contracts. Circle Contracts supports bytecode deployment, ABI-based contract interaction and smart-contract event monitoring.

---

# 25. Offchain Architecture

```text
┌──────────────────────────────────────────────────────┐
│                    Rivora Web App                    │
│ Borrower Dashboard │ LP Dashboard │ Risk Console    │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│                    Rivora API                        │
│ Authentication │ Borrowing │ Analytics │ Risk       │
└───────┬──────────────────┬──────────────────┬────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────┐
│ Revenue       │  │ Underwriting   │  │ Agent Policy │
│ Indexer       │  │ Engine         │  │ Engine       │
└───────┬───────┘  └────────┬───────┘  └──────┬───────┘
        │                   │                 │
        ▼                   ▼                 ▼
┌──────────────────────────────────────────────────────┐
│             Circle and Arc Integration Layer         │
│ Nanopayments │ Agent Wallets │ Contracts │ App Kit  │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│                       Arc                            │
│ Credit Vault │ Revenue Router │ Risk Registry       │
└──────────────────────────────────────────────────────┘
```

## 25.1 Revenue indexer

Responsibilities:

* Index x402 payment records
* Index settled revenue
* Associate payments with API requests
* Track refunds and failures
* Calculate payer distributions
* Detect related wallets
* Store daily aggregates

## 25.2 Underwriting engine

Responsibilities:

* Retrieve normalized signals
* Calculate deterministic factors
* Run anomaly detection
* Produce risk score
* Produce recommended credit limit
* Generate explanations
* Sign assessment payload

## 25.3 Agent orchestrator

Responsibilities:

* Trigger scheduled assessments
* Monitor risk conditions
* Submit onchain recommendations
* Initiate policy-compliant draw requests
* Purchase required risk data
* Trigger repayment and restriction workflows

## 25.4 Event processor

Responsibilities:

* Subscribe to contract events
* Update application database
* Trigger borrower notifications
* Trigger risk recalculation
* Maintain an audit trail

## 25.5 Sequence: revenue settlement to repayment

```text
Payer      Endpoint    Nanopayment   Router      Vault      Indexer
  │           │            │           │           │           │
  ├─request──►│            │           │           │           │
  │◄──402─────┤            │           │           │           │
  ├─signed authorization──►│           │           │           │
  │           │◄─verify────┤           │           │           │
  │◄──200 resource─────────┤           │           │           │
  │           │            │           │           │           │
  │           │            ├──────────────────────────────────►│
  │           │            │   authorization event (paidAt)    │
  │           │            │                                   │
  │           │      [ batch window ]                          │
  │           │            │           │           │           │
  │           │            ├─net settlement──►│    │           │
  │           │            │           │           │           │
  │           │            │           ├─accrue interest──────►│
  │           │            │           ├─repay principal──────►│
  │           │            │           ├─fund reserve          │
  │           │            │           ├─transfer operating──► borrower
  │           │            │           │           │           │
  │           │            │           ├──────────────────────►│
  │           │            │           │  settlement event (settledAt)
```

Two distinct timestamps are recorded for every unit of revenue. `paidAt` drives underwriting; `settledAt` drives repayment capacity and interest coverage. Conflating them overstates the borrower's ability to service debt by exactly the settlement lag.

## 25.6 Sequence: assessment to onchain limit

```text
Scheduler   Indexer   Underwriting   LLM      Risk Registry   Credit Manager
    │          │          Engine      │            │               │
    ├─trigger─────────────►│          │            │               │
    │          │◄─fetch────┤          │            │               │
    │          ├─signals──►│          │            │               │
    │          │           │          │            │               │
    │          │      [ deterministic factor computation ]         │
    │          │      [ Q, score, tier, L, constraints ]           │
    │          │           │          │            │               │
    │          │           ├─factors─►│            │               │
    │          │           │◄─prose───┤            │               │
    │          │           │   (explanation only — never a number) │
    │          │           │          │            │               │
    │          │           ├─hash(evidence)        │               │
    │          │           ├─sign(assessment)      │               │
    │          │           ├─submit───────────────►│               │
    │          │           │          │            │               │
    │          │           │      [ verify signer, nonce,          │
    │          │           │        expiry, replay ]               │
    │          │           │            ├─recommendation──────────►│
    │          │           │            │                          │
    │          │           │            │   [ enforce protocol caps,│
    │          │           │            │     horizon, custody,     │
    │          │           │            │     exposure, growth cap ]│
    │          │           │            │                          │
    │          │           │            │◄─approved limit ──────────┤
    │          │           │            │      (may be lower;       │
    │          │           │            │       never higher)       │
```

The LLM sits on a branch that produces text and nothing else. It never returns to the numeric path. This is the concrete implementation of the thesis that AI may analyse risk while deterministic policy controls funds, and it should be visible in the architecture rather than only asserted in prose.

---

# 26. Data Model

## 26.1 Borrower

```text
id
ownerWallet
operatingWallet
revenueRouter
serviceName
serviceType
endpointUrl
registrationDate
status
riskScore
creditLimit
outstandingPrincipal
accruedInterest
reserveBalance
repaymentRate
lastAssessmentAt
```

## 26.2 Revenue event

```text
id
borrowerId
payerWallet
amount
paymentMethod
requestId
serviceStatus
settlementStatus
eligibleAmount
exclusionReason
paidAt
settledAt
transactionHash
```

## 26.3 Customer aggregate

```text
borrowerId
payerWallet
totalRevenue
paymentCount
successfulRequests
failedRequests
refunds
firstSeenAt
lastSeenAt
concentrationShare
riskFlags
```

## 26.4 Risk assessment

```text
id
borrowerId
riskScore
recommendedLimit
approvedLimit
reliabilityFactor
diversityFactor
concentrationFactor
volatilityFactor
growthFactor
marginFactor
evidenceHash
explanation
modelVersion
createdAt
validUntil
transactionHash
```

## 26.5 Loan draw

```text
id
borrowerId
amount
interestRate
destination
useOfFunds
requestedAt
approvedAt
transactionHash
status
```

## 26.6 Repayment

```text
id
borrowerId
revenueEventId
grossAmount
interestPaid
principalPaid
reserveContribution
providerDistribution
transactionHash
createdAt
```

---

# 27. API Requirements

## Borrower APIs

```text
POST /v1/borrowers
GET  /v1/borrowers/:id
POST /v1/borrowers/:id/endpoints
GET  /v1/borrowers/:id/revenue
GET  /v1/borrowers/:id/risk
GET  /v1/borrowers/:id/credit
POST /v1/borrowers/:id/draws
POST /v1/borrowers/:id/repayments
```

## Underwriting APIs

```text
POST /v1/risk/assessments
GET  /v1/risk/assessments/:id
GET  /v1/risk/borrowers/:id/history
POST /v1/risk/borrowers/:id/restrict
POST /v1/risk/borrowers/:id/review
```

## Liquidity APIs

```text
GET  /v1/vault
GET  /v1/vault/positions/:wallet
POST /v1/vault/deposits
POST /v1/vault/withdrawals
GET  /v1/vault/borrowers
GET  /v1/vault/performance
```

## Webhook events

```text
revenue.received
revenue.settled
risk.assessment.completed
credit.limit.updated
credit.draw.completed
credit.repayment.completed
borrower.watchlisted
borrower.restricted
borrower.defaulted
vault.utilization.changed
```

---

# 28. Credit Delegation and Underwriting Services

## 28.1 Why this may be the larger business

Running a balance sheet requires Rivora to raise capital, hold risk, manage liquidity and, in most jurisdictions, hold a lending licence. Selling the underwriting and repayment infrastructure requires none of those.

Meanwhile the parties best positioned to lend to machine businesses already exist. An agent marketplace, an MCP registry, an inference aggregator or a cloud provider each has three assets Rivora would otherwise spend years acquiring:

* **Distribution.** They already have the borrowers.
* **Observation.** Revenue flows through them, so verification is trivial and diversion is structurally impossible.
* **Enforcement.** They control listing, ranking and access — the strongest non-legal recourse available against a machine business.

What they lack is the model, the contracts and the risk machinery. That is the trade.

## 28.2 Three products

### Score API

Read-only creditworthiness for a machine identity.

```text
POST /v1/underwriting/score

{
  "endpoint":       "https://api.example.com/v1/…",
  "routerAddress":  "0x…",
  "window":         30
}

→ {
  "score":              74,
  "tier":               "Standard",
  "recommendedLimit":   "4200.00",
  "maxAdvanceRate":     0.20,
  "maxHorizonDays":     45,
  "reliabilityBand":    "HIGH",
  "concentrationBand":  "ELEVATED",
  "custodyModel":       "A",
  "confidence":         0.81,
  "modelVersion":       "riv-uw-2.1",
  "evidenceHash":       "0x…",
  "validUntil":         "…",
  "signature":          "0x…"
}
```

Priced per call. No capital at risk. Bands rather than raw values, per the privacy section.

### Router as a service

The revenue router, endpoint binding, coverage monitoring and waterfall, deployed for a third party's own credit programme. Rivora takes a basis-point fee on routed volume and never touches the credit decision.

### Delegated credit pools

A partner underwrites its own suppliers using Rivora's rails, sets its own parameters within protocol bounds, and takes the first-loss position on its pool.

```text
Partner supplies:   borrower relationships, first-loss capital,
                    enforcement, revenue observation
Rivora supplies:    scoring model, contracts, router, risk monitoring,
                    liquidity from the shared vault above first loss
Loss order:         partner first-loss tranche → protocol reserve →
                    shared vault
Rivora revenue:     platform fee + interest spread on the senior portion
```

This is the structure that lets Rivora grow origination faster than it grows its own balance sheet, and it is why `RivoraDelegatedCredit.sol` appears in the production contract extensions.

## 28.3 Requirements

* Partner API keys with scoped permissions and per-partner rate limits.
* Signed, independently verifiable score attestations.
* Per-partner model versioning, so a partner's decisions remain reproducible after a model upgrade.
* Partner-level exposure caps enforced onchain.
* Clear contractual separation of who makes the credit decision, for licensing purposes.
* Partner sandbox with synthetic borrowers.

## 28.4 Sequencing

Delegation should not launch before Rivora's own book has demonstrated repayment performance. A scoring model with no realized loss history is not a product a partner can underwrite against. Target: Phase 2, after the private beta produces at least two full quarters of repayment and default data.

---

# 29. User Experience

## 29.1 Landing page

Primary message:

> **Credit for autonomous commerce**

Supporting message:

> Rivora transforms verifiable API and agent revenue into programmable USDC working capital.

Primary calls to action:

* Register a service
* Supply USDC
* View protocol activity

## 29.2 Borrower dashboard

Display:

* Available credit
* Outstanding debt
* Risk score
* Current interest rate
* Thirty-day eligible revenue
* Next estimated repayment
* Revenue allocation
* Credit-limit history
* Service health
* Risk warnings

## 29.3 Revenue page

Display:

* Revenue chart
* Eligible versus excluded revenue
* Unique customers
* Repeat-customer rate
* Customer-concentration chart
* Request success rate
* Revenue volatility
* Revenue-growth rate

## 29.4 Credit page

Display:

```text
Approved credit limit
Available credit
Outstanding principal
Accrued interest
Repayment percentage
Reserve target
Current borrower tier
```

Actions:

* Borrow USDC
* Repay manually
* View decision explanation

## 29.5 Liquidity-provider dashboard

Display:

* Total vault liquidity
* Available liquidity
* Outstanding loans
* Utilization
* Borrow rate
* LP yield
* Reserve coverage
* Historical losses
* Borrower distribution

## 29.6 Risk console

Display:

* Borrowers under watch
* Limit-change recommendations
* Revenue anomalies
* Concentration alerts
* Default probability
* Protocol exposure
* Reserve sufficiency

---

# 30. Circle and Arc Integration

## 30.1 Arc

Arc will provide:

* EVM smart-contract execution
* USDC-denominated gas
* Credit-vault settlement
* Revenue distribution
* Loan accounting
* Deterministic transaction finality

## 30.2 USDC

USDC will serve as:

* Liquidity-provider deposits
* Borrowed principal
* Revenue currency
* Repayment currency
* Reserve asset
* Interest-distribution asset
* Arc gas asset

## 30.3 Nanopayments and x402

Used for:

* API revenue generation
* Agent-to-service payments
* High-frequency service transactions
* Verifiable machine-generated cash flow

Nanopayments aggregate signed authorizations and settle net positions in batches rather than settling every small payment individually onchain.

## 30.4 Agent Wallets

Used for:

* Borrower agent wallets
* Policy-controlled spending
* USDC transfers
* Service purchases
* Autonomous repayment operations

## 30.5 Circle Contracts

Used for:

* Contract deployment
* Contract interaction
* Event monitoring
* Backend transaction workflows

## 30.6 App Kit

Future use:

* Bridge USDC to Arc
* Send stablecoins
* Access unified balances
* Swap supported stablecoins

App Kit provides stablecoin send, bridge, swap and fee-estimation capabilities, including USDC bridging that abstracts the underlying CCTP flow.

## 30.7 Gateway

Future use:

* Aggregate USDC held across supported chains
* Fund Arc credit operations
* Access a unified USDC balance
* Support crosschain revenue

Circle Gateway provides a unified USDC balance backed by deposits across multiple supported blockchains.

---

# 31. Security Requirements

## 31.1 Smart-contract security

Required controls:

* Reentrancy guards
* Checks-effects-interactions pattern
* Role-based access control
* Pausable lending and borrowing
* Withdrawal limits
* Safe USDC-transfer handling
* Assessment nonce validation
* Signature expiry
* Replay protection
* Integer precision controls
* Emergency debt freeze
* Upgrade governance delay
* Independent contract tests

## 31.2 Underwriting integrity

* Every assessment must include a model version.
* Input evidence must be hashed.
* Assessment signatures must be verified.
* Recommendations must expire.
* Smart contracts must apply hard exposure caps.
* AI explanations must not determine balances directly.
* Manual emergency review must be possible.

## 31.3 Agent security

* Apply maximum transaction values.
* Apply daily spending limits.
* Maintain recipient allowlists.
* Maintain contract blocklists.
* Require human approval above thresholds.
* Reject instructions that conflict with wallet policy.
* Isolate external API content from system instructions.
* Log every autonomous decision.

## 31.4 API security

* Signed webhook verification
* Idempotency keys
* Rate limiting
* Authentication and authorization
* Request-body validation
* Secrets-management system
* Audit logging
* Database encryption
* Endpoint ownership verification

## 31.5 Economic security

* Per-borrower exposure cap
* Per-sector exposure cap
* Customer-concentration cap
* Maximum vault utilization
* Minimum reserve coverage
* New-borrower limit
* Credit-growth cap
* Withdrawal-liquidity buffer
* Emergency lending pause

---

# 32. Compliance Considerations

Production deployment may involve regulated credit, lending, securities, money-transmission and investment activities depending on jurisdiction and product structure.

A production launch must evaluate:

* Borrower KYB
* Liquidity-provider eligibility
* Sanctions screening
* AML monitoring
* Lending licences
* Interest-rate restrictions
* Credit disclosure rules
* Data-protection obligations
* Securities classification of vault shares
* Tax reporting
* Cross-border lending restrictions

The hackathon MVP must:

* Use testnet assets only.
* State that credit scores are experimental.
* Avoid representing simulated yield as guaranteed.
* Avoid processing real customer credit.
* Separate demo logic from production compliance claims.

---

# 33. Non-Functional Requirements

## Performance

* Dashboard revenue update within 10 seconds of indexed event
* Risk assessment completion within 30 seconds
* API p95 response time below 500 milliseconds for read operations
* Idempotent repayment processing
* Reliable event reconciliation

## Availability

* 99.5% target for beta APIs
* Retry failed contract submissions
* Recover indexer state from blockchain events
* No dependence on a single LLM provider

## Explainability

* Every credit decision must expose contributing factors.
* Every excluded payment must include an exclusion reason.
* Every limit change must include an assessment version.
* Every autonomous transaction must include a policy decision record.

## Auditability

* Onchain transaction hashes
* Immutable risk-assessment hashes
* Model-version history
* Administrative-action logs
* Revenue-event provenance

---

# 34. Bootstrapping and Cold Start

## 34.1 The two-sided problem

Rivora requires liquidity providers to fund borrowers who have no repayment history, and borrowers to route revenue to a vault that may have no liquidity. Neither side has a reason to move first, and the usual failure mode is a protocol that launches, sits at near-zero utilization, and is read as evidence that machine credit does not work.

## 34.2 Protocol-seeded first loss

Rivora's treasury takes the junior position on the first cohort. This is the strongest possible signal that the underwriting model is believed by the people who wrote it.

```text
First-loss tranche:   10% of total vault assets, or full coverage of
                      cohort-1 principal, whichever is greater
Funded by:            protocol treasury
Loss order:           borrower reserve → protocol first loss →
                      protocol reserve → liquidity providers
Duration:             until cohort-1 borrowers complete 3 full
                      repayment cycles with no uncured default
Disclosure:           first-loss coverage ratio published continuously
```

Under this structure a cohort-1 liquidity provider is not underwriting the borrowers. They are underwriting Rivora's ability to lose its own money first. That is a materially easier ask and it is the standard way credit funds raise a first vintage.

## 34.3 Borrower cohort 1

Ten borrowers, hand-selected, not permissionless.

```text
Selection criteria:
    Verifiable x402 or nanopayment revenue for ≥ 60 days
    Named legal operator, KYB completed
    Custody Model A accepted (router as settlement destination)
    Real, documented working-capital need
    Willing to be a public reference

Terms:
    Maximum limit:        2,500 USDC per borrower
    Maximum aggregate:    25,000 USDC across the cohort
    Advance rate:         capped at 50% of tier base
    Security bond:        required, 20% of limit
```

The cohort is chosen for data quality rather than volume. Ten borrowers completing three clean repayment cycles each produces thirty data points on a model with no history — enough to justify opening cohort 2. One large borrower producing one cycle produces nothing.

## 34.4 Liquidity cohort 1

```text
Source:      ecosystem funds, strategic partners, the protocol treasury.
             Not retail, not permissionless.
Target:      250,000 USDC
Terms:       protocol first loss, 6% minimum yield during bootstrap,
             full portfolio transparency, quarterly reporting
Lockup:      none — the withdrawal queue is the liquidity mechanism
```

Opening permissionless deposits before repayment data exists is the specific anti-pattern to avoid. It attracts yield capital that leaves at the first loss, and the resulting withdrawal wave is indistinguishable from a failure of the model.

## 34.5 Sequencing gates

Each phase opens only when the prior phase clears a measurable gate.

| Gate | Requirement to advance |
| --- | --- |
| Cohort 1 → Cohort 2 | 10 borrowers, ≥ 25 completed repayment cycles, zero uncured defaults, coverage ratio ≥ 0.95 across the cohort |
| Cohort 2 → Open borrowing | ≥ 50 borrowers, ≥ 6 months of data, at least one realized default resolved through the full waterfall |
| Closed LP → Open LP | ≥ 2 quarters of published performance, first-loss tranche fully funded, withdrawal queue never exceeding 7 days |
| Own book → Delegated pools | ≥ 2 quarters of loss data, model validated against realized outcomes |

The requirement of **at least one realized default before opening borrowing** is deliberate. A protocol that has never processed a default does not know whether its default machinery works, and the first one should occur while the book is small and the protocol is holding the first loss.

## 34.6 What proves the model

The bootstrap succeeds or fails on one question: does revenue-based credit to machine businesses repay?

```text
Primary bootstrap metric:
    Percentage of principal repaid from routed revenue,
    without manual intervention, across cohort 1.

Target: > 95%
```

Everything else — TVL, borrower count, integrations — is secondary until that number exists.

---

# 35. Hackathon MVP

## 35.1 MVP objective

Demonstrate that verifiable machine revenue can automatically create, increase and repay a USDC credit line.

## 35.2 Scale and time compression

The earlier draft used a 15 USDC credit limit against a 30-day revenue base. At a 30% advance rate that implies roughly 50 USDC of monthly revenue, and at 20% routing a 20 USDC loan requires 100 USDC of revenue to clear. The demonstration works arithmetically but reads as a toy, and it contradicts the protocol's own worked example by two orders of magnitude.

The MVP therefore simulates a realistically sized service and compresses time rather than shrinking money.

```text
Simulated service:     market-data API, 0.04 USDC per request
Simulated period:      30 days of history, then 30 days forward
Time compression:      1 simulated day = 4 seconds of demo time
Vault seed:            25,000 testnet USDC
Denomination:          Arc Testnet USDC — no real value
```

Time compression is stated on screen throughout. A demo that silently accelerates time while showing an interest figure is showing a false number.

## 35.3 MVP scenario

Rivora operates a paid market-data API.

### Observation window: 30 simulated days

```text
Paid authorizations issued:        266,000
Settled successfully:              254,000   (95.5%)
Failed or unfulfilled:              12,000
Refunded:                            3,100

Gross revenue:                     10,640 USDC
Excluded revenue:                     640 USDC
  · related-wallet payments           410 USDC
  · refunded requests                  124 USDC
  · unfulfilled paid requests          106 USDC

Normalized eligible revenue R_30:  10,000 USDC

Unique eligible payers:                214
Repeat payers:                          95
Largest payer share:                   22%
Custody model:                           A
```

### Assessment 1

```text
Risk score:                             68
Tier:                             Standard
Base advance rate A:                  0.20

S = 0.88   C = 0.78   V = 0.85   D = 0.90   M = 0.85   G = 1.00

Q = 1 − [0.30(0.12) + 0.25(0.22) + 0.15(0.15)
       + 0.15(0.10) + 0.15(0.15)]
  = 1 − 0.151
  = 0.849

L_quality       = 10,000 × 0.20 × 0.849  =  1,698 USDC
L_horizon       = 10,000 × 0.20 × 1.5    =  3,000 USDC
L_new_borrower                            =  2,500 USDC

Approved credit limit                     =  1,690 USDC
Binding constraint                        =  quality factor
Borrower rate                             =  r(U) + 6% = 13.4%
```

### Draw 1

```text
Requested:        1,200 USDC
Purpose:          Model and data API expenses
Destination:      registered operating wallet
Interest coverage post-draw:  42.1   (≥ 3.0 required)
```

### Improvement window: 30 further simulated days

```text
Normalized eligible revenue:  10,000 → 13,500 USDC   (+35%)
Settlement success ratio:        88% → 96%
Repeat payers:                    95 → 168
Largest payer share:             22% → 14%
Refund rate:                    2.1% → 0.9%
```

### Assessment 2

```text
Risk score:                       68 → 78
Tier:                       Standard → Strong
Base advance rate A:            0.20 → 0.30

S = 0.95   C = 0.86   V = 0.90   D = 0.95   M = 0.88   G = 1.10

Q = 1 − 0.0905 = 0.9095

L_quality  = 13,500 × 0.30 × 0.9095 × 1.10  =  4,051 USDC
Growth cap = 1,690 × 1.50                    =  2,535 USDC

Approved credit limit                        =  2,530 USDC
Binding constraint     =  per-assessment growth cap
```

The growth cap binding here is intentional and is the more instructive outcome. It demonstrates that the protocol will not let a limit track a revenue jump immediately, which is the primary defence against manufactured growth.

### Draw 2

```text
Requested:        800 USDC
Outstanding principal after draw:  2,000 USDC
```

### Automatic repayment

```text
Daily eligible revenue:              450 USDC
Repayment allocation (20%):           90 USDC / day
Loss reserve (2%):                     9 USDC / day
Operating distribution (78%):        351 USDC / day

Projected full repayment:         ~23 simulated days
Interest coverage:                    ~104
```

### Risk event: manufactured revenue detected

Rather than a simple revenue decline, the MVP demonstrates the anti-manipulation controls operating on a live loan.

```text
Detection:
  3 payer wallets contributing 2,400 USDC over 9 days
  were first funded by the borrower's own operating wallet
  within 7 days of their first payment.

  Circular flow confirmed. Wallets clustered to a single entity.

Effect:
  Eligible R_30:            13,500 → 11,100 USDC
  Largest payer share:         14% → 19%
  Revenue diversity:          0.95 → 0.79
  Risk score:                   78 → 57
  Tier:                     Strong → Restricted

Protocol response:
  Credit limit                → 0 USDC
  New draws                   → blocked
  Repayment allocation        → 20% escalated to 35%
  Status                      → RESTRICTED
  Outstanding 2,000 USDC      → continues repaying from routed revenue
```

This is the scenario worth demonstrating. A graceful response to a revenue decline shows the protocol handling bad luck; catching a borrower inflating its own revenue and reducing its limit mid-loan shows the protocol handling bad faith, which is the harder and more relevant claim.

## 35.4 MVP features

Must include:

* Arc Testnet deployment
* USDC credit vault
* x402-compatible paid API
* Simulated nanopayment activity
* Borrower onboarding
* Revenue analytics
* Deterministic risk scoring
* AI-generated decision explanation
* Dynamic credit-limit update
* USDC borrowing
* Revenue Router
* Automatic repayment
* LP dashboard
* Successful and negative-risk scenario

## 35.5 MVP exclusions

Do not build:

* Governance token
* Secondary market
* Multi-chain lending
* Multiple borrower asset types
* Insurance tranches
* Complex machine-learning model
* Fiat integration
* Real USDC lending
* Full decentralized identity system

---

# 36. MVP Acceptance Criteria

The MVP is complete when:

1. A service receives at least one x402-style payment.
2. Revenue events appear in the borrower dashboard.
3. The underwriting engine calculates a risk score.
4. The engine calculates an explainable credit limit.
5. The approved limit is stored on Arc.
6. The borrower draws USDC from the vault.
7. The vault’s available liquidity decreases.
8. The borrower’s outstanding balance increases.
9. Subsequent revenue enters the Revenue Router.
10. Revenue automatically repays interest and principal.
11. The borrower receives the remaining revenue.
12. The LP vault balance reflects interest received.
13. A second assessment changes the credit limit.
14. A risk event can restrict new borrowing.
15. All financial actions show Arc transaction hashes.

---

# 37. Three-Minute Demo

## 0:00–0:25 — Problem

Show a market-data API earning 266,000 sub-cent USDC payments over 30 days — 10,000 USDC of verified revenue — and unable to buy the additional model capacity a demand spike requires.

> This business has revenue, customers and margin. It has no bank account, no credit file and no collateral. No lender on earth will underwrite it.

## 0:25–0:55 — Revenue underwriting

Show the revenue page:

```text
Gross revenue          10,640 USDC
Excluded revenue          640 USDC   ← with per-payment reasons
Eligible revenue       10,000 USDC
Settlement success        95.5%
Unique payers               214
Largest payer share         22%
```

Then the assessment, with the arithmetic on screen:

```text
Score 68  →  Standard  →  advance rate 20%
Quality factor Q = 0.849
Credit limit = 1,690 USDC
Binding constraint: quality factor
```

> Rivora underwrites this service from revenue it observed directly. Every excluded payment carries a reason, and every point of the quality haircut is attributable to a named factor.

## 0:55–1:20 — Custody binding

The differentiating 25 seconds. Show the endpoint probe running live.

```text
GET https://api.example.com/v1/quote        → 402 Payment Required
Advertised payTo:  0x7f3a…c1d2
Bound router:      0x7f3a…c1d2              ✓ MATCH

Coverage ratio: 0.98
```

> This is why the credit is safe. Repayment is not a promise the borrower makes — the router is the settlement destination, and Rivora re-verifies that every few minutes.

## 1:20–1:45 — Borrowing

The service's agent requests 1,200 USDC.

The policy engine verifies:

```text
Within available credit                     ✓
Interest coverage post-draw  42.1  ≥ 3.0    ✓
Projected payback  38 days  ≤ 45            ✓
Destination is the registered wallet        ✓
Purpose is an allowed operating category    ✓
Vault liquidity above buffer floor          ✓
```

USDC is transferred on Arc. Show the transaction hash.

## 1:45–2:10 — Dynamic credit

Advance the simulation 30 days.

```text
Revenue          10,000 → 13,500 USDC
Success rate         88% → 96%
Repeat payers         95 → 168
Largest payer        22% → 14%

Score  68 → 78        Tier  Standard → Strong
```

```text
Quality-derived limit          4,051 USDC
Per-assessment growth cap      2,535 USDC   ← binds
New credit limit               2,530 USDC
```

> Quality says 4,051. The growth cap says 2,535. The protocol takes the lower number and tells the borrower exactly why.

## 2:10–2:30 — Automatic repayment

New revenue settles into the Revenue Router.

```text
450 USDC/day
  ├── 20%  →  90 USDC   debt repayment
  ├──  2%  →   9 USDC   loss reserve
  └── 78%  → 351 USDC   provider wallet
```

Outstanding debt falls in real time. No borrower action, no treasury operation, no invoice.

## 2:30–2:55 — Bad faith, not bad luck

Inject manufactured revenue: three payer wallets funded by the borrower's own operating wallet.

```text
⚠  Circular funding detected across 3 payers
   2,400 USDC excluded from eligible revenue

   Score  78 → 57        Tier  Strong → Restricted
   Credit limit          2,530 → 0 USDC
   New draws             blocked
   Repayment allocation  20% → 35%
   Outstanding 2,000 USDC continues repaying
```

> The borrower tried to inflate its own revenue. Rivora removed it, cut the limit to zero, blocked new borrowing and increased the repayment rate — while the existing loan keeps repaying itself from real revenue.

## 2:55–3:00 — Close

> Rivora turns machine-generated revenue into programmable credit for autonomous commerce.

## Demo notes

* Show Arc transaction hashes for every financial action, on screen, not in a terminal.
* Keep the time-compression factor visible throughout.
* Lead the risk segment with the manipulation catch rather than a revenue decline. A graceful response to bad luck is table stakes; catching bad faith is the claim that distinguishes this from a lending dashboard.
* If a segment must be cut for time, cut dynamic credit at 1:45, not custody binding at 0:55. Custody binding is the answer to the first question any credit-literate judge will ask.

---

# 38. Success Metrics

## Borrower metrics

* Number of active borrowers
* Total eligible revenue
* Credit-approval rate
* Average credit limit
* Credit-limit growth
* Borrower retention
* Revenue routed through Rivora

## Lending metrics

* Total value locked
* Total borrowed
* Vault utilization
* Interest generated
* Average loan duration
* Repayment rate
* Delinquency rate
* Default rate
* Loss-reserve coverage

## Risk metrics

* Percentage of excluded revenue
* Customer-concentration distribution
* Model recommendation overrides
* Suspicious-payment detections
* Credit losses by borrower tier
* Risk-score migration

## Agent metrics

* Autonomous draw requests
* Policy-approved transactions
* Policy-rejected transactions
* Agent service payments
* Human-intervention rate

## North-star metric

> **Risk-adjusted USDC credit repaid from verified machine revenue**

---

# 39. Business Model

## 39.1 Interest spread

Rivora retains a percentage of interest paid by borrowers.

Example:

```text
Borrower interest rate:     12%
Liquidity-provider yield:    9%
Rivora protocol spread:      3%
```

## 39.2 Origination fee

A small fee may be charged on each draw.

Suggested range:

```text
0.10%–0.50%
```

## 39.3 SaaS subscription

Professional service operators may pay for:

* Advanced analytics
* Multi-service management
* Credit simulation
* Accounting exports
* Risk alerts
* Policy management
* Enterprise API access

## 39.4 Underwriting API

Third-party marketplaces can request:

* Machine credit score
* Revenue verification
* Recommended exposure
* Service-reliability score

## 39.5 Enterprise deployment

Rivora can provide private or permissioned credit pools for:

* Agent marketplaces
* API marketplaces
* Cloud providers
* Model-inference networks
* B2B software platforms

---

# 40. Product Roadmap

## Phase 0: Hackathon

* One x402 API
* One borrower
* One USDC vault
* Deterministic underwriting
* AI explanation
* Dynamic limit
* Automatic repayment
* Arc Testnet

## Phase 1: Private beta

* Multiple borrowers
* Real payment histories
* Borrower reserves
* Wallet policies
* LP withdrawals
* Risk monitoring
* KYB onboarding
* Protocol analytics

## Phase 2: Credit network

* Multiple credit pools
* Borrower tiers
* Delegated underwriting
* Insurance pool
* Junior and senior tranches
* Crosschain revenue aggregation
* Gateway integration
* App Kit funding

## Phase 3: Machine capital markets

* Tokenized machine receivables
* Revenue-forward contracts
* Fixed-term credit pools
* Credit-line syndication
* Buy-side credit for consuming agents
* Compute financing
* GPU leasing
* Agent insurance
* Tradable credit positions

## Phase 4: Autonomous treasury platform

* Agent treasury management
* Multi-currency stablecoin operations
* Stablecoin FX
* Cash-flow forecasting
* Automatic reserve allocation
* Enterprise policy engines
* Machine-to-machine procurement finance

## 40.1 Two expansions worth naming explicitly

## 40.2 Buy-side credit

Rivora as specified finances the **sell side**: services that earn revenue and need capital before it settles. The mirror-image problem is at least as large.

A consuming agent — a research agent, a procurement agent, a coding agent — must purchase inference, data and tools *before* the job it is working on pays out. It has the same working-capital mismatch, in the opposite direction, and no revenue history to underwrite against.

```text
Sell side (specified)      Buy side (adjacent)
─────────────────────      ───────────────────
Underwrite:  revenue       Underwrite:  pending job escrow,
                                        principal's credit,
                                        historical job completion
Collateral:  future        Collateral:  the escrowed job payment
             receivables                itself
Repay from:  routed        Repay from:  job settlement
             revenue
Router:      revenue       Router:      escrow release
             router
```

Buy-side credit reuses the router, the policy engine, the agent wallet integration and the identity layer almost unchanged. Only the underwriting input differs. It roughly doubles the addressable population, because every consuming agent is a candidate and consuming agents outnumber revenue-generating services.

It is deliberately out of scope until the sell-side loss model is validated, since it introduces a new and less proven collateral form.

## 40.3 Receivable tokenization and revenue forwards

Tokenized receivables are listed above as one bullet among several. They are, in fact, the transition from a lending application to an asset class, and the roadmap should treat them as the destination rather than a feature.

```text
A borrower sells 30 days of forward routed revenue
as a transferable claim.

    Buyer:        any capital allocator, not only Rivora's vault
    Pricing:      discount rate derived from the borrower's tier,
                  coverage ratio and custody model
    Settlement:   the router pays the claim holder before the
                  borrower's operating wallet
    Secondary:    the claim is transferable, so machine revenue
                  becomes a tradable fixed-income instrument
```

At that point Rivora is not lending its own vault's money. It is originating, scoring and servicing an asset that anyone can hold — which is the structure that lets machine credit scale past the size of any single balance sheet.

---

# 41. Product Risks

## Credit risk

Borrowers may experience a permanent decline in revenue.

## Manipulation risk

Borrowers may manufacture payment activity.

## Platform concentration

Revenue may depend heavily on a single agent marketplace or customer.

## Smart-contract risk

A contract vulnerability could affect borrower or LP funds.

## Regulatory risk

Revenue-based lending may require licences or investor restrictions.

## Model risk

The underwriting agent may produce inaccurate or biased recommendations.

## Liquidity risk

Liquidity providers may request withdrawals while most USDC is deployed.

## Adoption risk

The agent economy may not generate sufficient recurring revenue in the short term.

## Adverse-selection risk

The borrowers most eager for revenue-based credit may be those unable to obtain cheaper capital elsewhere. A well-performing AI API with an established corporate entity has access to platform lending, venture debt or equity at a lower cost of capital, and may use Rivora only when those are unavailable.

If unmanaged, the loan book fills with the residual — services that could not raise elsewhere — and realized losses exceed what the model predicts from revenue quality alone.

Mitigations:

* Compete on latency, availability and absence of prerequisites rather than on rate.
* Target the segment for which no alternative exists at all: pseudonymous, agent-operated and pre-entity services.
* Hand-select cohort 1 rather than opening permissionlessly.
* Track approval rate against application volume; a rising approval rate with falling revenue quality is the leading indicator.
* Price risk premiums by tier so that lower-quality borrowers pay for the selection effect rather than being cross-subsidized.

## Custody and settlement risk

If revenue cannot be structurally bound to the Revenue Router — because settlement destinations cannot be set to a contract, or can be changed unobservably — then repayment is voluntary and every advance rate in this document is too high. This is the single largest technical dependency in the protocol and is tracked in the revenue custody section.

## Correlated-shock risk

Machine businesses share upstream dependencies to an unusual degree. A price change at one model provider, an outage at one cloud region or a policy change at one agent marketplace can impair a large share of the loan book simultaneously. Diversification across borrowers does not diversify this exposure. Upstream concentration must be measured at portfolio level, not only per borrower.

## Integration risk

x402, Gateway, Agent Wallet and Arc interfaces may evolve during Rivora’s development.

---

# 42. Open Product Questions

## 42.1 Resolved in this version

| Question | Resolution |
| --- | --- |
| What minimum history before extending credit? | 30 days and 3-day revenue seasoning for MVP; 60 days for cohort 1. New-borrower cap of 2,500 USDC until 90 days of history. |
| Should every borrower provide a security bond? | Required under custody models B and C, above tier thresholds, and for cohort 1. Not universal. |
| Should repayment occur before or after nanopayment settlement? | After. Repayment can only be applied to settled funds. Underwriting uses `paidAt`; repayment capacity uses `settledAt`. |
| Can endpoints be cryptographically bound to a router? | Yes, by challenge-response at registration plus continuous `payTo` probing. Binding strength determines the maximum advance rate. |
| What percentage of revenue should remain available for operations? | 78% by default. The repayment share is derived from the target horizon rather than chosen independently. |
| How should lenders price compute-provider concentration? | Upstream concentration is recorded in the MVP and haircut at portfolio level in production. It is a correlated-shock exposure, not a per-borrower one. |
| Should machine credit scores be portable? | Yes. Portable signed attestations are the enforcement mechanism, not an optional feature. |
| Who may declare a default? | Automatic contract triggers, or a two-of-N risk-operator quorum with a published evidence hash. Never a single operator. |
| What may be revealed without exposing sensitive revenue data? | Specified in the privacy and disclosure section. Bucketed bands onchain; portfolio-level only to liquidity providers; payer identity never. |
| Should Rivora operate as a protocol, a fund or infrastructure? | Begin as a permissioned managed network. Infrastructure and delegation is the larger long-term business. |

## 42.2 Still open

1. Can an arbitrary contract address be registered as a nanopayment settlement destination in production? This gates the entire custody model.
2. Does per-payer attribution survive net batch settlement, or must it be reconstructed from the pre-settlement authorization feed? If it does not, diversity and concentration factors are not computable and the advance rate must fall.
3. Is the authorization feed available to a payee's designated underwriter, and under what authorization?
4. How should related payer wallets be identified without access to a shared clustering dataset? Funding-graph analysis catches naive cases; what catches a funded-once, long-dormant sybil set?
5. Should borrower loss reserves earn vault yield, and does that change their accounting treatment?
6. Should liquidity providers be able to select borrower risk tiers, or does tiered LP exposure create a securities-classification problem that a single blended pool avoids?
7. Should Rivora offer revolving credit or fixed-term advances first? Revolving is better product; fixed-term is easier to price and to syndicate.
8. Which jurisdictions are suitable for the first production pilot, given that the borrower may have no jurisdiction at all?
9. What is the correct treatment of a borrower whose revenue is genuine but whose end customers are themselves credit-financed agents? Second-order revenue quality is not addressed by the current factor set.
10. At what portfolio size does upstream-provider concentration require an explicit hedge rather than a haircut?
11. Should the protocol underwrite an agent that has no legal operator at all, and if so what is the enforcement mechanism beyond reputation?
12. How should the model be revalidated when realized losses first diverge from predicted losses, and who has authority to change coefficients?

---

# 43. Recommended Product Strategy

Rivora should begin as a managed, permissioned credit network rather than anonymous permissionless lending.

Initial borrowers should be selected service providers with:

* Verifiable x402 revenue
* Known operators
* Clear expense requirements
* Observable service fulfilment
* Revenue routed through Rivora
* Limited initial credit exposure

The first commercial product should be:

> **Short-duration USDC working-capital advances for AI APIs and MCP servers**

The initial credit line should remain small and automatically repay from revenue.

After establishing repayment performance, Rivora can expand into:

* Revolving credit
* GPU financing
* Compute leasing
* Agent insurance
* Marketplace credit
* Tokenized revenue pools

---

# 44. Final Product Definition

Rivora converts recurring machine revenue into programmable USDC liquidity.

```text
Machine provides a service
            ↓
Customer pays through x402
            ↓
Revenue becomes verifiable
            ↓
Rivora calculates creditworthiness
            ↓
Credit Vault provides USDC
            ↓
Agent spends within policy
            ↓
Future revenue repays the loan
            ↓
Successful repayment improves credit
```

The defining innovation is not AI-generated credit scoring by itself.

The core innovation is the complete closed-loop system:

> **Verifiable machine revenue → explainable underwriting → programmable USDC credit → autonomous spending → automatic repayment**

That loop creates the financial infrastructure required for autonomous digital businesses to grow without relying on traditional collateral or manual banking processes.

---

# 45. Glossary

| Term | Definition |
| --- | --- |
| **Advance rate (A)** | Share of normalized monthly revenue available as credit. Derived from the repayment share and the maximum horizon, not chosen independently. |
| **Agent Wallet** | Circle's policy-controlled wallet that an autonomous agent can operate directly, with configurable spending limits and allowlists. |
| **Arc** | EVM-compatible Layer-1 designed for stablecoin applications, using USDC as the native gas asset with sub-second deterministic finality. |
| **bps** | Basis points. One hundredth of one percent. `2,000 bps = 20%`. |
| **Borrow index** | Monotonically increasing accumulator used to compute interest across all borrowers without per-borrower iteration. |
| **Coverage ratio (routed revenue)** | Actual routed revenue divided by revenue expected from observed request volume. The primary diversion detector. |
| **Coverage ratio (interest)** | Daily repayment capacity divided by daily interest accrual. Guards against negative amortization. |
| **CV** | Coefficient of variation. Standard deviation divided by mean. Used as the volatility measure for daily revenue. |
| **Custody model** | Whether revenue arrives structurally at the router (A), by wallet policy (B), or by voluntary sweep (C). Bounds the advance rate. |
| **Eligible revenue** | Revenue passing the underwriting exclusion rules: not related-party, not refunded, not unfulfilled, seasoned, and not part of detected wash activity. |
| **Endpoint binding** | Cryptographic and probe-based proof that a registered service endpoint advertises the Rivora router as its payment destination. |
| **Evidence hash** | Hash committing to the exact input signals used in an assessment, making the decision reproducible and auditable without publishing the data. |
| **HHI** | Herfindahl-Hirschman Index. Sum of squared revenue shares. Ranges from near 0 (perfectly diverse) to 1 (single customer). |
| **KYB** | Know Your Business. Verification of a legal business entity, as distinct from KYC for individuals. |
| **Kink** | Utilization point at which the interest-rate curve steepens sharply to discourage further borrowing and protect withdrawal liquidity. |
| **MCP** | Model Context Protocol. Standard by which autonomous agents call external tools and services. |
| **Nanopayments** | Circle's batched settlement of signed payment authorizations, making sub-cent USDC payments economically practical. |
| **Normalized revenue (R₃₀)** | Time-weighted trailing 30-day eligible revenue, clamped against the median to suppress spikes. |
| **Quality factor (Q)** | Composite weighted-penalty multiplier between `Q_min` and 1, expressing the borrower's total quality haircut. |
| **Revenue Router** | Contract receiving borrower revenue and splitting it between repayment, loss reserve and the operating wallet. |
| **Seasoning** | Delay between settlement and eligibility for underwriting, allowing refunds and reversals to resolve. |
| **Tranche** | A layer of a capital structure absorbing losses in a defined order. Junior tranches absorb first. |
| **Utilization (U)** | Outstanding principal as a share of total vault assets. |
| **Waterfall** | Ordered allocation of funds. Used for both the revenue split and the default loss order. |
| **x402** | Use of HTTP status code 402 to negotiate payment for an API resource before serving it. |

---

# 46. Document Changelog

| Version | Summary |
| --- | --- |
| 1.0 | Initial product definition: closed-loop revenue-based credit for machine businesses. Multiplicative underwriting formula, x402 and nanopayment revenue collection, credit vault, revenue router, risk registry, hackathon MVP scope. |
| 1.1 | See below. |

## 46.1 Changes in version 1.1

**New sections**

* Why Now — the four converging enablers.
* Competitive Landscape — named alternatives, why a healthy borrower chooses Rivora, and where Rivora is structurally weaker.
* Revenue Custody and Settlement Binding — three custody models, endpoint binding and continuous probing, routed-revenue coverage ratio, settlement-lag consequences, and the open items requiring confirmation against Circle's production interfaces.
* Reputation and Enforcement — machine credit identity, permanent default registry, cure path, portable attestations, and default declaration authority.
* Borrower Privacy and Data Disclosure — disclosure tiers, bucketed factor bands, the router-throughput leak stated honestly, and the path to zero-knowledge factor proofs.
* Vault Liquidity Management — liquidity buffer floor, withdrawal queue, utilization-linked exit fee, loss socialization for queued positions, and bootstrap yield floor.
* Credit Delegation and Underwriting Services — score API, router-as-a-service, and delegated first-loss pools.
* Bootstrapping and Cold Start — protocol-seeded first loss, cohort composition, and sequencing gates.
* Glossary and this changelog.

**Underwriting model**

* Replaced the multiplicative factor product with a weighted-penalty composite quality factor. The prior form turned a stated 30% advance rate into an effective 15.6%.
* Derived the advance rate from the repayment share and maximum horizon rather than asserting 30%. The original figure is recovered exactly at 20% routing over 45 days.
* Added the repayment-horizon constraint and a stressed-horizon constraint.
* Added time-weighting, a median spike clamp and a seasoning delay to the revenue base.
* Rebuilt the service-reliability factor from protocol-observed inputs only; removed the borrower-reported quality score.
* Bounded the operating-capacity factor with protocol cost bands and added a verified-expense uplift.
* Removed the 0.40 floor on the concentration factor and added hard concentration ceilings.
* Made the growth factor asymmetric, with a −40% decline triggering WATCH.
* Reconciled the risk score and credit limit into a single pipeline: score → tier → advance rate → quality-modulated limit.

**Interest and repayment**

* Specified index-based accrual with stated precision and rounding direction.
* Added the negative-amortization guard, with interest coverage as a hard precondition on every draw.
* Specified that coverage must use settled rather than authorized revenue velocity.

**Other**

* Rescaled the MVP scenario from a 15 USDC limit to a realistically sized service with explicit time compression.
* Replaced the demo's soft revenue decline with a live manipulation catch, and added a custody-binding segment.
* Added buy-side credit and expanded receivable tokenization in the roadmap.
* Added adverse-selection, custody and correlated-shock risks.
* Split open questions into resolved and outstanding.
* Converted all broken LaTeX to plain-text and code-block notation; fixed the malformed piecewise rate blocks.
