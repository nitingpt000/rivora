// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDC} from "./MockUSDC.sol";
import {RivoraCreditVault} from "../src/RivoraCreditVault.sol";
import {RivoraCreditManager} from "../src/RivoraCreditManager.sol";
import {RivoraRiskRegistry} from "../src/RivoraRiskRegistry.sol";
import {BorrowerStatus, Tier} from "../src/RivoraTypes.sol";

/**
 * Attacks, rather than behaviours.
 *
 * `Protocol.t.sol` asserts the protocol does what it is meant to. This file
 * asserts it refuses what it is not — the exit queue in particular, which is
 * the one place where a claim on money is recorded in one transaction and
 * settled in another, and therefore the one place where a stale counter
 * becomes a withdrawal.
 */
contract AdversarialTest is Test {
    uint256 private constant USDC = 1e6;
    bytes32 private constant BORROWER_ID = keccak256("quotestream");

    MockUSDC private usdc;
    RivoraCreditVault private vault;
    RivoraCreditManager private manager;
    RivoraRiskRegistry private registry;

    address private admin = makeAddr("admin");
    address private lp = makeAddr("liquidityProvider");
    address private attacker = makeAddr("attacker");
    address private borrower = makeAddr("borrower");
    address private operating = makeAddr("operatingWallet");
    address private router = makeAddr("router");

    uint256 private underwriterKey;
    address private underwriter;

    function setUp() public {
        (underwriter, underwriterKey) = makeAddrAndKey("underwriter");
        usdc = new MockUSDC();

        vm.startPrank(admin);
        vault = new RivoraCreditVault(usdc, admin);
        registry = new RivoraRiskRegistry(admin);
        manager = new RivoraCreditManager(usdc, vault, registry, admin);
        vault.grantRole(vault.CREDIT_MANAGER_ROLE(), address(manager));
        registry.grantRole(registry.UNDERWRITER_ROLE(), underwriter);
        manager.registerBorrower(BORROWER_ID, borrower, router, operating, 2_000, 200);
        vm.stopPrank();

        usdc.mint(lp, 1_000_000 * USDC);
        usdc.mint(attacker, 1_000_000 * USDC);
        usdc.mint(borrower, 1_000_000 * USDC);
    }

    function _deposit(address who, uint256 amount) private {
        vm.startPrank(who);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    /**
     * Grants a limit the only way the protocol allows: a signed assessment in
     * the registry, adopted by the manager.
     */
    function _grantLimit(uint256 limit, uint256 nonce) private {
        RivoraRiskRegistry.RiskAssessment memory assessment = RivoraRiskRegistry.RiskAssessment({
            borrowerId: BORROWER_ID,
            riskScore: 80,
            recommendedLimit: limit,
            tier: Tier.Strong,
            evidenceHash: keccak256("evidence"),
            validUntil: block.timestamp + 1 days,
            nonce: nonce
        });

        (uint8 v, bytes32 r, bytes32 s_) =
            vm.sign(underwriterKey, registry.hashAssessment(assessment));
        registry.submitAssessment(assessment, abi.encodePacked(r, s_, v));
        manager.syncLimitFromRegistry(BORROWER_ID);
    }

    // ── the exit queue ─────────────────────────────────────────────────────

    /**
     * The claim counter must not resurrect a claim that was already paid.
     *
     * A partially funded exit that is claimed leaves `funded` at zero while
     * `amount` still names the full original claim. If nothing records what
     * was already paid, the next repayment funds the same claim again and the
     * provider can claim a second time — withdrawing money that belongs to
     * everyone else.
     */
    function test_partialClaimCannotBePaidTwice() public {
        _deposit(lp, 100_000 * USDC);

        // Lend out enough that a large exit must queue.
        _grantLimit(90_000 * USDC, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 90_000 * USDC);

        // 10,000 idle. Ask for 50,000: part served, the rest queued.
        vm.prank(lp);
        (uint256 immediateOut, uint256 queued) = vault.withdraw(50_000 * USDC);
        assertGt(queued, 0, "the exit should have queued");

        uint256 index = vault.queueLength() - 1;

        // A repayment arrives and partially funds the queued claim.
        vm.startPrank(borrower);
        usdc.approve(address(manager), 20_000 * USDC);
        manager.repay(BORROWER_ID, 20_000 * USDC);
        vm.stopPrank();

        uint256 before = usdc.balanceOf(lp);
        vm.prank(lp);
        uint256 firstClaim = vault.claimQueued(index);

        // A second repayment. If the claim was resurrected, this refunds it.
        vm.startPrank(borrower);
        usdc.approve(address(manager), 30_000 * USDC);
        manager.repay(BORROWER_ID, 30_000 * USDC);
        vm.stopPrank();

        uint256 secondClaim;
        vm.prank(lp);
        try vault.claimQueued(index) returns (uint256 claimed) {
            secondClaim = claimed;
        } catch {
            secondClaim = 0;
        }

        uint256 totalPaidOut = usdc.balanceOf(lp) - before + immediateOut;

        // The provider must never receive more than the exit they asked for.
        assertLe(firstClaim + secondClaim, queued, "queued claims paid out more than was ever owed");
        assertLe(totalPaidOut, 50_000 * USDC, "exit paid more than requested");
    }

    /**
     * Funding must not allocate the same idle dollars to two claims.
     *
     * Funded-but-unclaimed money is still sitting in the vault, so a naive
     * `availableLiquidity()` read counts it again on the next repayment and
     * promises it to the next provider in the queue. Both then hold a claim
     * on one balance, and whoever calls second finds it gone.
     */
    function test_fundingDoesNotDoubleAllocateIdleLiquidity() public {
        _deposit(lp, 100_000 * USDC);
        _deposit(attacker, 100_000 * USDC);

        _grantLimit(180_000 * USDC, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 180_000 * USDC);

        // Two providers queue exits, in order.
        vm.prank(lp);
        (, uint256 queuedA) = vault.withdraw(40_000 * USDC);
        vm.prank(attacker);
        (, uint256 queuedB) = vault.withdraw(40_000 * USDC);
        assertGt(queuedA, 0);
        assertGt(queuedB, 0);

        // One repayment, enough to fund the first claim only.
        vm.startPrank(borrower);
        usdc.approve(address(manager), 40_000 * USDC);
        manager.repay(BORROWER_ID, 40_000 * USDC);
        vm.stopPrank();

        // A second repayment of the same size.
        vm.startPrank(borrower);
        usdc.approve(address(manager), 40_000 * USDC);
        manager.repay(BORROWER_ID, 40_000 * USDC);
        vm.stopPrank();

        // Both providers claim. Neither may fail for lack of balance: the
        // vault promised both, so the vault must hold both.
        uint256 fundedA = vault.queueEntry(vault.queueLength() - 2).funded;
        uint256 fundedB = vault.queueEntry(vault.queueLength() - 1).funded;

        assertLe(
            fundedA + fundedB,
            usdc.balanceOf(address(vault)),
            "more was promised to the queue than the vault holds"
        );
    }

    /**
     * Shares burned on exit must never exceed the shares held, and the assets
     * released must never exceed what those shares were worth.
     */
    function testFuzz_withdrawNeverReleasesMoreThanSharesAreWorth(uint96 depositRaw, uint96 exitRaw)
        public
    {
        uint256 depositAmount = uint256(depositRaw) % (500_000 * USDC);
        vm.assume(depositAmount > 10 * USDC);

        _deposit(lp, depositAmount);

        // Bounded by what the shares are actually worth, not by what was
        // deposited: the dead shares mean the first depositor holds slightly
        // less than they put in, and asking for more is correctly refused.
        uint256 redeemable = vault.convertToAssets(vault.balanceOf(lp));
        vm.assume(redeemable > 0);
        uint256 exit = (uint256(exitRaw) % redeemable) + 1;
        vm.assume(exit <= redeemable);

        uint256 sharesBefore = vault.balanceOf(lp);
        uint256 balanceBefore = usdc.balanceOf(lp);

        vm.prank(lp);
        (uint256 immediateOut, uint256 queued) = vault.withdraw(exit);

        uint256 released = usdc.balanceOf(lp) - balanceBefore;
        uint256 burned = sharesBefore - vault.balanceOf(lp);

        assertLe(released, exit, "released more than requested");
        assertLe(burned, sharesBefore, "burned more shares than held");
        assertLe(immediateOut + queued, exit + 1, "plan exceeds the request");
    }

    // ── router rotation ────────────────────────────────────────────────────

    /**
     * A borrower must be able to change router without being re-registered.
     *
     * Registration was the only place the field could be written, so a router
     * that had to be replaced — upgraded, or compromised — stranded the
     * borrower with the original permanently.
     */
    function test_routerCanBeRotatedAndTheOldOneLosesAuthority() public {
        address replacement = makeAddr("replacementRouter");

        vm.prank(admin);
        manager.setRevenueRouter(BORROWER_ID, replacement);

        assertEq(manager.accountOf(BORROWER_ID).revenueRouter, replacement);
        assertTrue(manager.hasRole(manager.ROUTER_ROLE(), replacement));
        assertEq(manager.routerToBorrower(replacement), BORROWER_ID);

        // The replaced router must not still be able to book repayments.
        assertFalse(manager.hasRole(manager.ROUTER_ROLE(), router));
        assertEq(manager.routerToBorrower(router), bytes32(0));
    }

    function test_onlyRiskMayRotateTheRouter() public {
        address replacement = makeAddr("replacementRouter");

        vm.prank(borrower);
        vm.expectRevert();
        manager.setRevenueRouter(BORROWER_ID, replacement);
    }

    function test_routerCannotBeRotatedToNothing() public {
        vm.prank(admin);
        vm.expectRevert();
        manager.setRevenueRouter(BORROWER_ID, address(0));
    }
}
