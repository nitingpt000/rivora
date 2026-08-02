// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/**
 * Shared types and constants.
 *
 * Every monetary value in the protocol is USDC at 6 decimals, matching the
 * ERC-20 interface on Arc. Note that Arc's *native* gas token is the same USDC
 * at 18 decimals — the two scales are not interchangeable, and nothing in
 * these contracts touches the native balance.
 */

/// Borrower lifecycle. Mirrors `BorrowerStatus` in `@rivora/core`.
enum BorrowerStatus {
    OBSERVATION,
    ELIGIBLE,
    ACTIVE,
    WATCH,
    RESTRICTED,
    DELINQUENT,
    DEFAULTED,
    REPAID
}

/// Score bands. Mirrors `Tier` in `@rivora/core`.
enum Tier {
    Prime,
    Strong,
    Standard,
    Restricted,
    Ineligible
}

// Line comments rather than NatSpec blocks throughout: solc parses `/** */`
// above a state variable as documentation and rejects `@rivora/core` as an
// unknown tag.
library RivoraConstants {
    // Basis-point denominator. 10,000 bps == 100%.
    uint256 internal constant BPS = 10_000;

    // Share of vault assets that must remain liquid. Withdrawals above this
    // enter the FIFO queue rather than draining the liquidity the book depends
    // on. Mirrors VAULT.bufferFloorPct in the core package; Differential.t.sol
    // asserts the two agree.
    uint256 internal constant BUFFER_FLOOR_BPS = 1_500;

    // Utilization above which a withdrawal fee applies. PRD §23.5.
    uint256 internal constant FEE_THRESHOLD_BPS = 8_000;

    // Utilization at which the withdrawal fee reaches its maximum.
    uint256 internal constant FEE_CEILING_BPS = 9_500;

    // Maximum withdrawal fee, at or above the ceiling utilization.
    uint256 internal constant MAX_WITHDRAWAL_FEE_BPS = 100;

    // Repayment share while a borrower is restricted. PRD §11.4.
    uint256 internal constant ESCALATED_REPAYMENT_BPS = 3_500;
}

// How a repayment was applied. Interest before principal, always. Mirrors
// RepaymentApplication in the core package — a divergence means the borrower's
// preview and the chain disagree about the same payment.
struct RepaymentApplication {
    uint256 amount;
    uint256 toInterest;
    uint256 toPrincipal;
    // Returned when the payment exceeds the debt.
    uint256 excess;
    bool clearsDebt;
}

// How a withdrawal request is served. Mirrors WithdrawalPlan.
struct WithdrawalPlan {
    uint256 requested;
    // Served from liquidity above the buffer floor.
    uint256 immediate;
    // Enters the FIFO queue, funded by incoming repayments.
    uint256 queued;
    uint256 fee;
    uint256 bufferFloor;
    uint256 availableNow;
}
