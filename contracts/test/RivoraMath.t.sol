// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {RivoraMath} from "../src/RivoraMath.sol";
import {RepaymentApplication, WithdrawalPlan, RivoraConstants} from "../src/RivoraTypes.sol";

// The arithmetic on the chain's own terms, at USDC's full six decimals.
//
// The differential suite pins these functions to the TypeScript at cent
// precision, which is where the two libraries overlap. This covers what
// happens below a cent, and the properties that must hold for *every* input
// rather than for the chosen fixtures.
contract RivoraMathTest is Test {
    uint256 private constant USDC = 1e6;

    function test_applyRepayment_subCentGoesToInterest() public pure {
        // A single base unit — a millionth of a dollar. Below the precision
        // `@rivora/core` reports, but the chain must still place it correctly
        // rather than dropping it.
        RepaymentApplication memory result = RivoraMath.applyRepayment(1, 2_000 * USDC, 8_420_000);

        assertEq(result.toInterest, 1, "sub-cent payment should reduce interest");
        assertEq(result.toPrincipal, 0);
        assertEq(result.excess, 0);
        assertFalse(result.clearsDebt);
    }

    function test_applyRepayment_zeroDebtClearsNothing() public pure {
        RepaymentApplication memory result = RivoraMath.applyRepayment(100, 0, 0);

        assertEq(result.toInterest, 0);
        assertEq(result.toPrincipal, 0);
        assertEq(result.excess, 100, "everything comes back when nothing is owed");
        // Not "cleared": there was no debt to clear, and reporting otherwise
        // would let a payment against an empty loan look like a repayment
        // cycle, which lifts the new-borrower cap.
        assertFalse(result.clearsDebt);
    }

    /// Interest is always taken before principal, whatever the split.
    function testFuzz_applyRepayment_interestFirst(
        uint128 amount,
        uint128 principal,
        uint128 interest
    ) public pure {
        RepaymentApplication memory result = RivoraMath.applyRepayment(amount, principal, interest);

        if (result.toPrincipal > 0) {
            assertEq(
                result.toInterest, interest, "principal was touched before interest was cleared"
            );
        }
    }

    /// Nothing is created or destroyed: applied + excess == requested.
    function testFuzz_applyRepayment_conserves(uint128 amount, uint128 principal, uint128 interest)
        public
        pure
    {
        RepaymentApplication memory result = RivoraMath.applyRepayment(amount, principal, interest);

        assertEq(
            result.toInterest + result.toPrincipal + result.excess,
            amount,
            "repayment did not conserve the amount"
        );
        assertLe(result.toInterest, interest);
        assertLe(result.toPrincipal, principal);
    }

    /// The waterfall must sum exactly to the input, for every input. PRD §22.5.
    function testFuzz_splitRevenue_conserves(uint128 amount, uint16 repaymentBps, uint16 reserveBps)
        public
        pure
    {
        repaymentBps = uint16(bound(repaymentBps, 0, RivoraConstants.BPS));
        reserveBps = uint16(bound(reserveBps, 0, RivoraConstants.BPS - repaymentBps));

        (uint256 toRepayment, uint256 toReserve, uint256 toOperating) =
            RivoraMath.splitRevenue(amount, repaymentBps, reserveBps);

        // The reason `toOperating` is a remainder rather than its own
        // percentage: rounding can never mint or strand a base unit.
        assertEq(toRepayment + toReserve + toOperating, amount, "waterfall did not conserve");
    }

    function test_availableCredit_saturatesAtZero() public pure {
        // Possible after a limit reduction: principal now exceeds the limit.
        assertEq(RivoraMath.availableCredit(1_690 * USDC, 2_000 * USDC, 0), 0);
    }

    function testFuzz_availableCredit_neverExceedsLimit(
        uint128 limit,
        uint128 principal,
        uint128 pending
    ) public pure {
        assertLe(RivoraMath.availableCredit(limit, principal, pending), limit);
    }

    function test_withdrawalFee_zeroBelowThreshold() public pure {
        assertEq(RivoraMath.withdrawalFeeBps(0), 0);
        assertEq(RivoraMath.withdrawalFeeBps(RivoraConstants.FEE_THRESHOLD_BPS), 0);
    }

    function test_withdrawalFee_capsAtCeiling() public pure {
        assertEq(
            RivoraMath.withdrawalFeeBps(RivoraConstants.FEE_CEILING_BPS),
            RivoraConstants.MAX_WITHDRAWAL_FEE_BPS
        );
        // Above the ceiling it stays capped rather than growing.
        assertEq(
            RivoraMath.withdrawalFeeBps(RivoraConstants.BPS), RivoraConstants.MAX_WITHDRAWAL_FEE_BPS
        );
    }

    function testFuzz_withdrawalFee_monotonic(uint256 a, uint256 b) public pure {
        a = bound(a, 0, RivoraConstants.BPS);
        b = bound(b, a, RivoraConstants.BPS);

        // A fee that fell as utilization rose would reward exiting exactly when
        // the vault can least afford it.
        assertLe(RivoraMath.withdrawalFeeBps(a), RivoraMath.withdrawalFeeBps(b));
    }

    function testFuzz_planWithdrawal_conserves(
        uint128 requested,
        uint128 liquidity,
        uint128 assets,
        uint16 utilBps
    ) public pure {
        utilBps = uint16(bound(utilBps, 0, RivoraConstants.BPS));

        WithdrawalPlan memory plan =
            RivoraMath.planWithdrawal(requested, liquidity, assets, utilBps);

        assertEq(plan.immediate + plan.queued, requested, "withdrawal did not conserve");
        assertLe(plan.immediate, liquidity, "served more than the vault holds");
        assertLe(plan.fee, plan.immediate, "fee exceeded the amount served");
    }

    /// The buffer floor is never breached by an immediate payout.
    function testFuzz_planWithdrawal_respectsBufferFloor(
        uint128 requested,
        uint128 liquidity,
        uint128 assets
    ) public pure {
        WithdrawalPlan memory plan = RivoraMath.planWithdrawal(requested, liquidity, assets, 0);

        uint256 floor = (uint256(assets) * RivoraConstants.BUFFER_FLOOR_BPS) / RivoraConstants.BPS;

        if (liquidity > floor) {
            assertLe(plan.immediate, uint256(liquidity) - floor, "payout broke the buffer floor");
        } else {
            assertEq(plan.immediate, 0, "paid out with liquidity already at the floor");
        }
    }

    function test_accrueInterest_zeroCases() public pure {
        assertEq(RivoraMath.accrueInterest(0, 1_200, 365 days), 0);
        assertEq(RivoraMath.accrueInterest(1_000 * USDC, 0, 365 days), 0);
        assertEq(RivoraMath.accrueInterest(1_000 * USDC, 1_200, 0), 0);
    }

    function test_accrueInterest_annualRate() public pure {
        // 12% of 1,000 USDC over a year.
        assertEq(RivoraMath.accrueInterest(1_000 * USDC, 1_200, 365 days), 120 * USDC);
    }

    function testFuzz_accrueInterest_monotonicInTime(uint64 shorter, uint64 longer) public pure {
        vm.assume(shorter <= longer);

        assertLe(
            RivoraMath.accrueInterest(1_000 * USDC, 1_200, shorter),
            RivoraMath.accrueInterest(1_000 * USDC, 1_200, longer)
        );
    }
}
