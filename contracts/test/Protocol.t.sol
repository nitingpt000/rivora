// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDC} from "./MockUSDC.sol";
import {RivoraCreditVault} from "../src/RivoraCreditVault.sol";
import {RivoraCreditManager} from "../src/RivoraCreditManager.sol";
import {RivoraRevenueRouter} from "../src/RivoraRevenueRouter.sol";
import {RivoraRiskRegistry} from "../src/RivoraRiskRegistry.sol";
import {BorrowerStatus, Tier, RivoraConstants} from "../src/RivoraTypes.sol";

// The four contracts working together, from deposit to draw to routed repayment.
//
// The scenario is the seeded one the rest of the product uses: a 25,000 USDC
// vault, one borrower with a 2,530 limit, a 20/2/78 waterfall.
contract ProtocolTest is Test {
    uint256 private constant USDC = 1e6;
    bytes32 private constant BORROWER_ID = keccak256("quotestream");

    MockUSDC private usdc;
    RivoraCreditVault private vault;
    RivoraCreditManager private manager;
    RivoraRiskRegistry private registry;
    RivoraRevenueRouter private router;

    address private admin = makeAddr("admin");
    address private lp = makeAddr("liquidityProvider");
    address private borrower = makeAddr("borrower");
    address private operating = makeAddr("operatingWallet");
    address private reserve = makeAddr("lossReserve");
    address private keeper = makeAddr("keeper");

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

        router = new RivoraRevenueRouter(
            usdc,
            BORROWER_ID,
            admin,
            address(vault),
            address(manager),
            reserve,
            operating,
            2_000,
            200
        );

        manager.registerBorrower(BORROWER_ID, borrower, address(router), operating, 2_000, 200);
        vm.stopPrank();

        usdc.mint(lp, 100_000 * USDC);
        usdc.mint(borrower, 10_000 * USDC);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    function _deposit(address who, uint256 amount) private {
        vm.startPrank(who);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function _assess(uint256 limit, uint256 score, uint256 nonce) private {
        RivoraRiskRegistry.RiskAssessment memory assessment = RivoraRiskRegistry.RiskAssessment({
            borrowerId: BORROWER_ID,
            riskScore: score,
            recommendedLimit: limit,
            tier: Tier.Strong,
            evidenceHash: keccak256("evidence"),
            validUntil: block.timestamp + 1 days,
            nonce: nonce
        });

        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(underwriterKey, registry.hashAssessment(assessment));

        registry.submitAssessment(assessment, abi.encodePacked(r, s, v));
        manager.syncLimitFromRegistry(BORROWER_ID);
    }

    // ── vault ──────────────────────────────────────────────────────────────

    function test_deposit_mintsSharesAndSeedsDeadShares() public {
        _deposit(lp, 25_000 * USDC);

        assertEq(vault.totalAssets(), 25_000 * USDC);
        // The dead shares are what closes the first-depositor inflation attack.
        assertEq(vault.balanceOf(address(0xdead)), vault.DEAD_SHARES());
        assertEq(vault.balanceOf(lp), 25_000 * USDC - vault.DEAD_SHARES());
    }

    function test_deposit_secondDepositorIsNotDiluted() public {
        _deposit(lp, 25_000 * USDC);

        address second = makeAddr("second");
        usdc.mint(second, 10_000 * USDC);
        _deposit(second, 10_000 * USDC);

        // No interest has accrued, so the second deposit buys assets 1:1.
        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(second)), 10_000 * USDC, 1);
    }

    function test_withdraw_servedInFullBelowBufferFloor() public {
        _deposit(lp, 25_000 * USDC);

        vm.prank(lp);
        (uint256 immediate, uint256 queued) = vault.withdraw(1_000 * USDC);

        assertEq(immediate, 1_000 * USDC);
        assertEq(queued, 0);
    }

    function test_withdraw_queuesAboveTheBufferFloor() public {
        _deposit(lp, 25_000 * USDC);

        // Lend most of it out, leaving liquidity near the 15% floor.
        _assess(20_000 * USDC, 78, 0);
        vm.prank(borrower);
        manager.draw(BORROWER_ID, 20_000 * USDC);

        vm.prank(lp);
        (uint256 immediate, uint256 queued) = vault.withdraw(5_000 * USDC);

        assertGt(queued, 0, "exit should be partially queued");
        assertEq(immediate + queued, 5_000 * USDC);
        assertEq(vault.queueTotal(), queued);
    }

    function test_queue_isFundedByRepaymentsAndClaimable() public {
        _deposit(lp, 25_000 * USDC);
        _assess(20_000 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 20_000 * USDC);

        vm.prank(lp);
        (, uint256 queued) = vault.withdraw(5_000 * USDC);
        assertGt(queued, 0);

        // A settled batch repays, which is what funds the queue.
        usdc.mint(address(router), 30_000 * USDC);
        vm.prank(keeper);
        router.distributeRevenue();

        RivoraCreditVault.QueueEntry memory entry = vault.queueEntry(0);
        assertGt(entry.funded, 0, "repayment should have funded the queue");

        uint256 before = usdc.balanceOf(lp);
        vm.prank(lp);
        uint256 claimed = vault.claimQueued(0);

        assertEq(usdc.balanceOf(lp) - before, claimed, "claim did not pay out");
        assertGt(claimed, 0);
    }

    function test_queue_onlyTheOwnerMayClaim() public {
        _deposit(lp, 25_000 * USDC);
        _assess(20_000 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 20_000 * USDC);

        vm.prank(lp);
        vault.withdraw(5_000 * USDC);

        vm.prank(makeAddr("thief"));
        vm.expectRevert(RivoraCreditVault.NotQueueOwner.selector);
        vault.claimQueued(0);
    }

    function test_queue_claimingNothingReverts() public {
        _deposit(lp, 25_000 * USDC);
        _assess(20_000 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 20_000 * USDC);

        vm.prank(lp);
        vault.withdraw(5_000 * USDC);

        // Nothing has repaid yet, so nothing is funded.
        vm.prank(lp);
        vm.expectRevert(RivoraCreditVault.NothingToClaim.selector);
        vault.claimQueued(0);
    }

    function test_previewWithdraw_matchesWhatWithdrawDoes() public {
        _deposit(lp, 25_000 * USDC);
        _assess(20_000 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 20_000 * USDC);

        uint256 previewImmediate = vault.previewWithdraw(5_000 * USDC).immediate;

        vm.prank(lp);
        (uint256 immediate,) = vault.withdraw(5_000 * USDC);

        // A preview that disagreed with the action would be worse than none.
        assertEq(immediate, previewImmediate);
    }

    function test_fundDraw_onlyTheCreditManager() public {
        _deposit(lp, 25_000 * USDC);

        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        vault.fundDraw(BORROWER_ID, 1_000 * USDC, makeAddr("attacker"));
    }

    function test_fundDraw_cannotSpendLiquidityOwedToTheQueue() public {
        _deposit(lp, 25_000 * USDC);
        _assess(24_000 * USDC, 78, 0);

        // Draw enough that a large exit must queue.
        vm.prank(borrower);
        manager.draw(BORROWER_ID, 20_000 * USDC);

        vm.prank(lp);
        vault.withdraw(5_000 * USDC);

        uint256 queueOwed = vault.queueTotal();
        assertGt(queueOwed, 0);

        // Read before arming `expectRevert` — it applies to the next call, and
        // an argument evaluated after it would be intercepted instead of the
        // call under test.
        uint256 remaining = vault.availableLiquidity();
        assertEq(remaining, queueOwed, "all remaining liquidity is owed to the queue");

        // That liquidity is spoken for, so a further draw against it must fail
        // rather than let a borrower jump the exit queue.
        vm.prank(borrower);
        vm.expectRevert(
            abi.encodeWithSelector(RivoraCreditVault.InsufficientLiquidity.selector, remaining, 0)
        );
        manager.draw(BORROWER_ID, remaining);
    }

    function test_recordLoss_onlyRisk() public {
        _deposit(lp, 25_000 * USDC);

        vm.prank(makeAddr("attacker"));
        vm.expectRevert();
        vault.recordLoss(BORROWER_ID, 100 * USDC);
    }

    // ── credit ─────────────────────────────────────────────────────────────

    function test_borrowerStartsInObservationWithNoLimit() public view {
        RivoraCreditManager.BorrowerAccount memory account = manager.accountOf(BORROWER_ID);

        assertEq(uint8(account.status), uint8(BorrowerStatus.OBSERVATION));
        assertEq(account.creditLimit, 0);
    }

    function test_draw_requiresAnAssessment() public {
        _deposit(lp, 25_000 * USDC);

        vm.prank(borrower);
        vm.expectRevert(
            abi.encodeWithSelector(
                RivoraCreditManager.DrawsBlocked.selector, BorrowerStatus.OBSERVATION
            )
        );
        manager.draw(BORROWER_ID, 100 * USDC);
    }

    function test_assessment_setsLimitAndActivates() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        RivoraCreditManager.BorrowerAccount memory account = manager.accountOf(BORROWER_ID);

        assertEq(account.creditLimit, 2_530 * USDC);
        assertEq(account.riskScore, 78);
        assertEq(uint8(account.status), uint8(BorrowerStatus.ACTIVE));
    }

    function test_draw_movesFundsToTheRegisteredOperatingWallet() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 2_000 * USDC);

        // Funds go where the borrower registered them, not to the caller.
        assertEq(usdc.balanceOf(operating), 2_000 * USDC);
        assertEq(vault.totalBorrowed(), 2_000 * USDC);
        assertEq(vault.availableLiquidity(), 23_000 * USDC);
        // Total assets are unchanged: the loan is still an asset of the vault.
        assertEq(vault.totalAssets(), 25_000 * USDC);
    }

    function test_draw_refusesAboveTheLimit() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(borrower);
        vm.expectRevert(
            abi.encodeWithSelector(
                RivoraCreditManager.ExceedsAvailableCredit.selector, 3_000 * USDC, 2_530 * USDC
            )
        );
        manager.draw(BORROWER_ID, 3_000 * USDC);
    }

    function test_draw_onlyTheRegisteredOwner() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(RivoraCreditManager.NotBorrowerOwner.selector, attacker)
        );
        manager.draw(BORROWER_ID, 100 * USDC);
    }

    function test_repay_appliesInterestFirstAndReturnsNoExcess() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 2_000 * USDC);

        skip(30 days);

        uint256 owed = manager.outstandingDebt(BORROWER_ID);
        assertGt(owed, 2_000 * USDC, "interest should have accrued");

        uint256 before = usdc.balanceOf(borrower);

        vm.startPrank(borrower);
        usdc.approve(address(manager), 10_000 * USDC);
        // Deliberately overpays. Only the debt should be pulled.
        manager.repay(BORROWER_ID, 10_000 * USDC);
        vm.stopPrank();

        assertApproxEqAbs(before - usdc.balanceOf(borrower), owed, 1e3, "overpaid");
        assertEq(manager.outstandingDebt(BORROWER_ID), 0);
    }

    // ── routing ────────────────────────────────────────────────────────────

    function test_router_splitsRevenueAndRepays() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 2_000 * USDC);

        // A settled batch arrives from Gateway as a plain transfer.
        usdc.mint(address(router), 450 * USDC);

        // Permissionless: a passer-by can trigger the distribution.
        vm.prank(keeper);
        router.distributeRevenue();

        assertEq(usdc.balanceOf(reserve), 9 * USDC, "2% to the loss reserve");
        assertEq(usdc.balanceOf(operating), 2_000 * USDC + 351 * USDC, "78% to operating");
        assertEq(router.totalToRepayment(), 90 * USDC, "20% to repayment");
        assertLt(manager.outstandingDebt(BORROWER_ID), 2_000 * USDC, "debt should have fallen");
    }

    function test_router_neverRoutesMoreThanIsOwed() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 10 * USDC);

        uint256 owed = manager.outstandingDebt(BORROWER_ID);

        // 20% of this batch is 200 USDC against a 10 USDC debt.
        usdc.mint(address(router), 1_000 * USDC);
        vm.prank(keeper);
        router.distributeRevenue();

        assertEq(manager.outstandingDebt(BORROWER_ID), 0, "debt cleared");
        assertEq(router.totalToRepayment(), owed, "routed exactly the debt, no more");
        // Everything not owed reached the borrower rather than being stranded.
        assertEq(usdc.balanceOf(address(router)), 0, "router should hold nothing after a split");
    }

    function test_router_distributionIsPermissionless() public {
        usdc.mint(address(router), 100 * USDC);

        // No debt, so it all flows to reserve and operating.
        vm.prank(makeAddr("passerby"));
        router.distributeRevenue();

        assertEq(usdc.balanceOf(address(router)), 0);
    }

    function test_router_borrowerCannotChangeTheSplit() public {
        vm.prank(borrower);
        vm.expectRevert();
        router.configure(address(vault), address(manager), reserve, operating, 0, 0);
    }

    // ── risk registry ──────────────────────────────────────────────────────

    function test_registry_rejectsAnUnauthorisedSigner() public {
        (, uint256 rogueKey) = makeAddrAndKey("rogue");

        RivoraRiskRegistry.RiskAssessment memory assessment = RivoraRiskRegistry.RiskAssessment({
            borrowerId: BORROWER_ID,
            riskScore: 99,
            recommendedLimit: 1_000_000 * USDC,
            tier: Tier.Prime,
            evidenceHash: keccak256("forged"),
            validUntil: block.timestamp + 1 days,
            nonce: 0
        });

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(rogueKey, registry.hashAssessment(assessment));

        vm.expectRevert();
        registry.submitAssessment(assessment, abi.encodePacked(r, s, v));
    }

    function test_registry_rejectsAReplayedAssessment() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        RivoraRiskRegistry.RiskAssessment memory assessment = RivoraRiskRegistry.RiskAssessment({
            borrowerId: BORROWER_ID,
            riskScore: 78,
            recommendedLimit: 2_530 * USDC,
            tier: Tier.Strong,
            evidenceHash: keccak256("evidence"),
            validUntil: block.timestamp + 1 days,
            nonce: 0
        });

        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(underwriterKey, registry.hashAssessment(assessment));

        vm.expectRevert(abi.encodeWithSelector(RivoraRiskRegistry.InvalidNonce.selector, 1, 0));
        registry.submitAssessment(assessment, abi.encodePacked(r, s, v));
    }

    function test_registry_rejectsAnExpiredAssessment() public {
        RivoraRiskRegistry.RiskAssessment memory assessment = RivoraRiskRegistry.RiskAssessment({
            borrowerId: BORROWER_ID,
            riskScore: 78,
            recommendedLimit: 2_530 * USDC,
            tier: Tier.Strong,
            evidenceHash: keccak256("stale"),
            validUntil: block.timestamp + 1 hours,
            nonce: 0
        });

        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(underwriterKey, registry.hashAssessment(assessment));

        skip(2 hours);

        vm.expectRevert();
        registry.submitAssessment(assessment, abi.encodePacked(r, s, v));
    }

    // ── risk actions ───────────────────────────────────────────────────────

    function test_restrict_zeroesTheLimitAndEscalatesRepayment() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(admin);
        manager.restrict(BORROWER_ID, "binding broken");

        RivoraCreditManager.BorrowerAccount memory account = manager.accountOf(BORROWER_ID);
        assertEq(account.creditLimit, 0);
        assertEq(account.repaymentBps, RivoraConstants.ESCALATED_REPAYMENT_BPS);
        assertEq(uint8(account.status), uint8(BorrowerStatus.RESTRICTED));

        vm.prank(borrower);
        vm.expectRevert();
        manager.draw(BORROWER_ID, 1 * USDC);
    }

    function test_recordLoss_lowersTheSharePriceForEveryone() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(borrower);
        manager.draw(BORROWER_ID, 2_000 * USDC);

        uint256 priceBefore = vault.sharePrice();

        vm.prank(admin);
        vault.recordLoss(BORROWER_ID, 500 * USDC);

        assertLt(vault.sharePrice(), priceBefore, "a realised loss must be socialised");
        assertEq(vault.totalLosses(), 500 * USDC);
    }

    function test_pause_blocksDepositsAndDraws() public {
        _deposit(lp, 25_000 * USDC);
        _assess(2_530 * USDC, 78, 0);

        vm.prank(admin);
        vault.pause();

        vm.startPrank(lp);
        usdc.approve(address(vault), 100 * USDC);
        vm.expectRevert();
        vault.deposit(100 * USDC);
        vm.stopPrank();

        vm.prank(borrower);
        vm.expectRevert();
        manager.draw(BORROWER_ID, 100 * USDC);
    }

    // ── invariant ──────────────────────────────────────────────────────────

    /// The vault must always hold enough to cover what it says it holds.
    function testFuzz_vaultSolvency(uint96 deposit, uint96 drawAmount) public {
        uint256 deposited = bound(deposit, 1_000 * USDC, 50_000 * USDC);
        usdc.mint(lp, deposited);
        _deposit(lp, deposited);

        _assess(deposited, 78, 0);

        uint256 drawn = bound(drawAmount, 0, deposited / 2);
        if (drawn > 0) {
            vm.prank(borrower);
            manager.draw(BORROWER_ID, drawn);
        }

        assertEq(
            vault.totalAssets(),
            usdc.balanceOf(address(vault)) + vault.totalBorrowed(),
            "vault accounting drifted from its balance"
        );
        assertGe(vault.totalAssets(), 0);
    }
}
