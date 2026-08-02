// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {RivoraMath} from "../src/RivoraMath.sol";
import {RepaymentApplication, WithdrawalPlan, RivoraConstants} from "../src/RivoraTypes.sol";

// Pins the Solidity arithmetic to the TypeScript.
//
// The borrower is shown a preview computed by the core package before they
// sign; the chain then computes the real thing. If those two disagree, the
// number the borrower consented to is not the number that executed — a class
// of bug that no amount of unit testing on either side alone can catch.
//
// Fixtures in test/fixtures/core.json are produced by running the actual
// TypeScript (script/generate-fixtures.ts), not by hand. Regenerate with
// `pnpm fixtures`; the test target does it automatically.
//
// Line comments rather than a NatSpec block: solc rejects `@rivora/core` as an
// unknown documentation tag.
contract DifferentialTest is Test {
    using stdJson for string;

    string private json;

    function setUp() public {
        json = vm.readFile("test/fixtures/core.json");
    }

    function test_applyRepayment_matchesCore() public view {
        uint256 count = json.readUint(".repaymentCount");
        assertGt(count, 0, "no repayment fixtures");

        for (uint256 i = 0; i < count; i++) {
            string memory at = string.concat(".repayment[", vm.toString(i), "]");
            string memory label = json.readString(string.concat(at, ".label"));

            RepaymentApplication memory result = RivoraMath.applyRepayment(
                _num(at, ".amount"), _num(at, ".principal"), _num(at, ".accruedInterest")
            );

            assertEq(result.amount, _num(at, ".expectedApplied"), _why(label, "amount"));
            assertEq(result.toInterest, _num(at, ".expectedToInterest"), _why(label, "toInterest"));
            assertEq(
                result.toPrincipal, _num(at, ".expectedToPrincipal"), _why(label, "toPrincipal")
            );
            assertEq(result.excess, _num(at, ".expectedExcess"), _why(label, "excess"));
            assertEq(
                result.clearsDebt,
                json.readBool(string.concat(at, ".expectedClearsDebt")),
                _why(label, "clearsDebt")
            );
        }
    }

    function test_availableCredit_matchesCore() public view {
        uint256 count = json.readUint(".availableCount");
        assertGt(count, 0, "no availability fixtures");

        for (uint256 i = 0; i < count; i++) {
            string memory at = string.concat(".available[", vm.toString(i), "]");
            string memory label = json.readString(string.concat(at, ".label"));

            uint256 actual = RivoraMath.availableCredit(
                _num(at, ".limit"), _num(at, ".principal"), _num(at, ".pendingDraws")
            );

            assertEq(actual, _num(at, ".expected"), _why(label, "availableCredit"));
        }
    }

    function test_planWithdrawal_matchesCore() public view {
        uint256 count = json.readUint(".withdrawalCount");
        assertGt(count, 0, "no withdrawal fixtures");

        for (uint256 i = 0; i < count; i++) {
            string memory at = string.concat(".withdrawal[", vm.toString(i), "]");
            string memory label = json.readString(string.concat(at, ".label"));

            WithdrawalPlan memory plan = RivoraMath.planWithdrawal(
                _num(at, ".requested"),
                _num(at, ".availableLiquidity"),
                _num(at, ".totalAssets"),
                _num(at, ".utilizationBps")
            );

            assertEq(plan.bufferFloor, _num(at, ".expectedBufferFloor"), _why(label, "bufferFloor"));
            assertEq(
                plan.availableNow, _num(at, ".expectedAvailableNow"), _why(label, "availableNow")
            );
            assertEq(plan.immediate, _num(at, ".expectedImmediate"), _why(label, "immediate"));
            assertEq(plan.queued, _num(at, ".expectedQueued"), _why(label, "queued"));
        }
    }

    /**
     * The buffer floor constant itself must agree.
     *
     * Every withdrawal fixture would still pass if both sides used the same
     * *wrong* floor, so the constant is asserted directly against the value
     * the fixtures were generated with.
     */
    function test_bufferFloorConstant_matchesCore() public view {
        // 15% of 25,000 USDC == 3,750 USDC, from the first withdrawal fixture.
        uint256 assets = _num(".withdrawal[0]", ".totalAssets");
        uint256 expectedFloor = _num(".withdrawal[0]", ".expectedBufferFloor");

        assertEq(
            (assets * RivoraConstants.BUFFER_FLOOR_BPS) / RivoraConstants.BPS,
            expectedFloor,
            "BUFFER_FLOOR_BPS disagrees with VAULT.bufferFloorPct in @rivora/core"
        );
    }

    function _num(string memory at, string memory field) private view returns (uint256) {
        // Fixture numbers are strings, so a 256-bit value cannot be mangled by
        // JSON's float representation on the way across.
        return vm.parseUint(json.readString(string.concat(at, field)));
    }

    function _why(string memory label, string memory field) private pure returns (string memory) {
        return string.concat("core disagreement [", label, "] on ", field);
    }
}
