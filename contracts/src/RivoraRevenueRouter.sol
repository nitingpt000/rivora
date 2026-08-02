// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {RivoraMath} from "./RivoraMath.sol";
import {RivoraConstants} from "./RivoraTypes.sol";

interface ICreditManager {
    /// Debt including interest accrued but not yet written to storage.
    function outstandingDebt(bytes32 borrowerId) external view returns (uint256);
    /// Books a repayment whose funds have already reached the vault.
    function receiveRepayment(bytes32 borrowerId, uint256 amount) external;
}

/**
 * Splits a borrower's settled revenue three ways.
 *
 * One router per borrower. This is the contract the whole credit thesis rests
 * on: a fixed share of every settled batch services the debt *before* the
 * remainder reaches the borrower.
 *
 * ## Why distribution is pull-based
 *
 * The PRD assumed this contract could be registered as the nanopayment
 * settlement destination, so that a settling batch would call it and the
 * waterfall would execute atomically on receipt. That is not how Circle
 * Nanopayments settles: proceeds land in the seller's Circle Gateway balance,
 * and reach Arc only when a burn intent withdraws them to a recipient. That
 * withdrawal is a plain ERC-20 transfer, and **an ERC-20 transfer does not
 * execute code at the recipient**.
 *
 * So `distributeRevenue()` cannot be a callback. It is a permissionless
 * function that operates on whatever balance this contract is holding, and
 * anyone may call it — the borrower, a Rivora keeper, or a passer-by. Making
 * it permissioned would mean revenue could sit undistributed because the one
 * permitted caller was down, which is precisely the failure the structural
 * claim is supposed to rule out.
 *
 * Calling it is never harmful: the split is fixed by configuration the
 * borrower cannot change, so an unexpected caller can only cause the intended
 * distribution to happen sooner.
 *
 * ## What this does not solve
 *
 * If the borrower controls the Gateway balance, they control whether a
 * withdrawal to this address happens at all. That makes repayment behavioural
 * rather than structural — PRD §11.2 Model C, not Model A — and the advance
 * rate must be graded accordingly. Restoring enforceability requires Rivora to
 * hold the withdrawal right, which is a Circle account configuration question,
 * not something this contract can assert.
 */
contract RivoraRevenueRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// Held by the Credit Manager, to update the split after an assessment.
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");

    IERC20 public immutable usdc;
    bytes32 public immutable borrowerId;

    /**
     * Where repayment funds are *transferred*, and where the repayment is
     * *booked*, are two different addresses.
     *
     * The vault holds the money; the manager owns the borrower's debt. Sending
     * the funds to the manager and booking them against the vault — as an
     * earlier version did — leaves USDC stranded in a contract whose
     * accounting says it is somewhere else.
     */
    address public creditVault;
    address public creditManager;
    /// Where the reserve share accumulates.
    address public reserveAccount;
    /// Where the borrower's remainder goes.
    address public operatingWallet;

    uint256 public repaymentBps;
    uint256 public reserveBps;

    /// Cumulative totals, for reconciliation against the indexer.
    uint256 public totalDistributed;
    uint256 public totalToRepayment;
    uint256 public totalToReserve;
    uint256 public totalToOperating;

    event RevenueDistributed(
        address indexed caller,
        uint256 amount,
        uint256 toRepayment,
        uint256 toReserve,
        uint256 toOperating
    );

    /**
     * Emitted on every configuration change.
     *
     * The endpoint-binding probe watches for these: a borrower redirecting
     * their operating wallet or a change in the repayment share is exactly the
     * event the anti-diversion control exists to notice.
     */
    event RoutingConfigured(
        address indexed creditVault,
        address indexed creditManager,
        address indexed operatingWallet,
        address reserveAccount,
        uint256 repaymentBps,
        uint256 reserveBps
    );

    error ZeroAddress();
    error SharesExceedTotal(uint256 repaymentBps, uint256 reserveBps);
    error NothingToDistribute();

    constructor(
        IERC20 usdc_,
        bytes32 borrowerId_,
        address admin,
        address creditVault_,
        address creditManager_,
        address reserveAccount_,
        address operatingWallet_,
        uint256 repaymentBps_,
        uint256 reserveBps_
    ) {
        if (address(usdc_) == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }

        usdc = usdc_;
        borrowerId = borrowerId_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CONFIG_ROLE, admin);

        _configure(
            creditVault_,
            creditManager_,
            reserveAccount_,
            operatingWallet_,
            repaymentBps_,
            reserveBps_
        );
    }

    /**
     * Distributes everything this contract currently holds.
     *
     * Permissionless by design — see the contract notes. Operates on the live
     * balance rather than on a caller-supplied amount, so it cannot be told to
     * distribute more than has arrived, and a caller cannot pick a favourable
     * subset.
     */
    function distributeRevenue() external nonReentrant returns (uint256 amount) {
        amount = usdc.balanceOf(address(this));
        if (amount == 0) revert NothingToDistribute();

        (uint256 toRepayment, uint256 toReserve, uint256 toOperating) =
            RivoraMath.splitRevenue(amount, repaymentBps, reserveBps);

        /**
         * Never route more than is owed.
         *
         * The repayment share is a percentage of revenue, not of debt, so a
         * borrower whose balance is nearly cleared would otherwise have more
         * routed to repayment than they owe. The manager cannot accept that —
         * it has no way to return the difference — so the excess goes where it
         * belongs: to the borrower. This is also the behaviour PRD §12.2
         * specifies, where a cleared borrower's allocation becomes 0/2/98.
         */
        uint256 owed = ICreditManager(creditManager).outstandingDebt(borrowerId);
        if (toRepayment > owed) {
            toOperating += toRepayment - owed;
            toRepayment = owed;
        }

        // Effects before interactions. The totals are updated here so that a
        // token with a transfer hook cannot reenter and observe a stale figure.
        totalDistributed += amount;
        totalToRepayment += toRepayment;
        totalToReserve += toReserve;
        totalToOperating += toOperating;

        if (toRepayment > 0) {
            // Funds to the vault, accounting to the manager.
            usdc.safeTransfer(creditVault, toRepayment);
            ICreditManager(creditManager).receiveRepayment(borrowerId, toRepayment);
        }
        if (toReserve > 0) usdc.safeTransfer(reserveAccount, toReserve);
        if (toOperating > 0) usdc.safeTransfer(operatingWallet, toOperating);

        emit RevenueDistributed(msg.sender, amount, toRepayment, toReserve, toOperating);
    }

    /// Amount waiting to be distributed. Read by the keeper to decide whether
    /// a distribution transaction is worth its gas.
    function pendingRevenue() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * Updates the split and the destinations.
     *
     * Restricted to `CONFIG_ROLE`, held by the Credit Manager — the borrower
     * must not be able to reduce their own repayment share, which would make
     * every underwriting control advisory.
     */
    function configure(
        address creditVault_,
        address creditManager_,
        address reserveAccount_,
        address operatingWallet_,
        uint256 repaymentBps_,
        uint256 reserveBps_
    ) external onlyRole(CONFIG_ROLE) {
        _configure(
            creditVault_,
            creditManager_,
            reserveAccount_,
            operatingWallet_,
            repaymentBps_,
            reserveBps_
        );
    }

    function _configure(
        address creditVault_,
        address creditManager_,
        address reserveAccount_,
        address operatingWallet_,
        uint256 repaymentBps_,
        uint256 reserveBps_
    ) private {
        if (
            creditVault_ == address(0) || creditManager_ == address(0)
                || reserveAccount_ == address(0) || operatingWallet_ == address(0)
        ) {
            revert ZeroAddress();
        }
        // Without this the operating share would underflow, and a borrower
        // could be configured into a router that reverts on every settlement.
        if (repaymentBps_ + reserveBps_ > RivoraConstants.BPS) {
            revert SharesExceedTotal(repaymentBps_, reserveBps_);
        }

        creditVault = creditVault_;
        creditManager = creditManager_;
        reserveAccount = reserveAccount_;
        operatingWallet = operatingWallet_;
        repaymentBps = repaymentBps_;
        reserveBps = reserveBps_;

        emit RoutingConfigured(
            creditVault_,
            creditManager_,
            operatingWallet_,
            reserveAccount_,
            repaymentBps_,
            reserveBps_
        );
    }
}
