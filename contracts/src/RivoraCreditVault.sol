// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {RivoraMath} from "./RivoraMath.sol";
import {WithdrawalPlan, RivoraConstants} from "./RivoraTypes.sol";

/**
 * The credit vault.
 *
 * Liquidity providers deposit USDC and receive `RIV-USDC` shares. The share
 * price rises as borrowers pay interest and falls when a loss is realised, so
 * a provider's return and their exposure are the same number.
 *
 * ## Why not ERC-4626
 *
 * ERC-4626 promises that `withdraw` returns the assets requested. This vault
 * cannot promise that: liquidity below the buffer floor is committed to the
 * book, and a withdrawal above it is partially queued. Implementing the
 * interface and then violating its central expectation would be worse than not
 * implementing it — integrators would build on a guarantee that does not hold.
 * The share accounting follows 4626's model; the exit path is explicit.
 *
 * ## Share-price manipulation
 *
 * The classic first-depositor attack — deposit 1 wei, donate a large amount,
 * then round every later depositor's shares to zero — is closed by seeding
 * `MIN_INITIAL_DEPOSIT` worth of shares to address zero on the first deposit.
 * The dead shares make the price impossible to inflate cheaply.
 */
contract RivoraCreditVault is ERC20, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// Held by the Credit Manager: the only thing that may move borrower funds.
    bytes32 public constant CREDIT_MANAGER_ROLE = keccak256("CREDIT_MANAGER_ROLE");
    /// May pause and record losses.
    bytes32 public constant RISK_ROLE = keccak256("RISK_ROLE");

    /// Shares burned to address zero on first deposit, in asset terms.
    uint256 public constant DEAD_SHARES = 1e6;

    IERC20 public immutable asset;

    /// Principal currently lent out. `totalAssets` is this plus idle liquidity.
    uint256 public totalBorrowed;
    /// Cumulative interest received, for reporting.
    uint256 public totalInterestReceived;
    /// Cumulative principal written off.
    uint256 public totalLosses;

    /// FIFO exit queue. Providers claim as repayments fund it.
    struct QueueEntry {
        address owner;
        uint256 amount;
        uint256 funded;
        bool claimed;
    }

    QueueEntry[] private _queue;
    /// Total still owed to the queue.
    uint256 public queueTotal;
    /// Index of the next entry to fund.
    uint256 public queueHead;

    event Deposited(address indexed owner, uint256 assets, uint256 shares);
    event Withdrawn(
        address indexed owner, uint256 assets, uint256 shares, uint256 fee, uint256 queued
    );
    event DrawFunded(bytes32 indexed borrowerId, address indexed recipient, uint256 amount);
    event RepaymentReceived(bytes32 indexed borrowerId, uint256 principal, uint256 interest);
    event LossRecorded(bytes32 indexed borrowerId, uint256 amount);
    event QueueEntryFunded(uint256 indexed index, uint256 amount);
    event QueueEntryClaimed(uint256 indexed index, address indexed owner, uint256 amount);

    error ZeroAmount();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error InsufficientShares(uint256 held, uint256 required);
    error NothingToClaim();
    error NotQueueOwner();

    constructor(IERC20 asset_, address admin) ERC20("Rivora Credit Vault USDC", "RIV-USDC") {
        asset = asset_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ROLE, admin);
    }

    /// Shares track the asset's precision — 6 decimals on Arc, not 18.
    function decimals() public view override returns (uint8) {
        return IERC20Metadata(address(asset)).decimals();
    }

    /// Idle liquidity plus principal outstanding.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)) + totalBorrowed;
    }

    /// Liquidity not lent out. Includes amounts owed to the exit queue.
    function availableLiquidity() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function utilizationBps() public view returns (uint256) {
        return RivoraMath.utilizationBps(totalBorrowed, availableLiquidity());
    }

    /// Value of one whole share, in assets.
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 10 ** decimals();
        return (totalAssets() * (10 ** decimals())) / supply;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        return (assets * supply) / totalAssets();
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    /**
     * Supplies USDC and mints shares.
     *
     * Shares are computed before the transfer lands, so the depositor is not
     * diluted by their own deposit.
     */
    function deposit(uint256 assets) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();

        shares = convertToShares(assets);

        // First deposit seeds unredeemable shares, closing the inflation attack
        // where a tiny first deposit plus a donation rounds later depositors to
        // zero shares.
        if (totalSupply() == 0) {
            if (assets <= DEAD_SHARES) revert ZeroAmount();
            _mint(address(0xdead), DEAD_SHARES);
            shares = assets - DEAD_SHARES;
        }

        asset.safeTransferFrom(msg.sender, address(this), assets);
        _mint(msg.sender, shares);

        emit Deposited(msg.sender, assets, shares);
    }

    /**
     * Redeems shares, serving what the buffer allows and queueing the rest.
     *
     * Shares are burned in full up front, including the queued portion — the
     * queued claim is a fixed asset amount, so those shares stop earning at
     * the moment of queue entry rather than continuing to accrue while the
     * provider waits. PRD §23.4.
     */
    function withdraw(uint256 assets)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 immediate, uint256 queued)
    {
        if (assets == 0) revert ZeroAmount();

        uint256 shares = convertToShares(assets);
        uint256 held = balanceOf(msg.sender);
        if (shares > held) revert InsufficientShares(held, shares);

        WithdrawalPlan memory plan = RivoraMath.planWithdrawal(
            assets, availableLiquidity(), totalAssets(), utilizationBps()
        );

        _burn(msg.sender, shares);

        if (plan.queued > 0) {
            _queue.push(
                QueueEntry({owner: msg.sender, amount: plan.queued, funded: 0, claimed: false})
            );
            queueTotal += plan.queued;
        }

        // The fee stays in the vault, accruing to the providers who did not
        // exit — which is the point of charging it.
        uint256 payout = plan.immediate - plan.fee;
        if (payout > 0) asset.safeTransfer(msg.sender, payout);

        emit Withdrawn(msg.sender, plan.immediate, shares, plan.fee, plan.queued);
        return (plan.immediate, plan.queued);
    }

    /// Preview, so a caller can see the split before committing.
    function previewWithdraw(uint256 assets) external view returns (WithdrawalPlan memory) {
        return
            RivoraMath.planWithdrawal(assets, availableLiquidity(), totalAssets(), utilizationBps());
    }

    /**
     * Funds an approved draw.
     *
     * Only the Credit Manager may call this: the vault does not decide who may
     * borrow, it only holds the money. The buffer floor is *not* enforced here
     * — lending is what the buffer exists to protect against being unable to
     * do, and the manager has already checked the borrower's limit.
     */
    function fundDraw(bytes32 borrowerId, uint256 amount, address recipient)
        external
        nonReentrant
        whenNotPaused
        onlyRole(CREDIT_MANAGER_ROLE)
    {
        if (amount == 0) revert ZeroAmount();

        uint256 liquid = availableLiquidity();
        // Liquidity owed to the queue is not lendable.
        uint256 lendable = liquid > queueTotal ? liquid - queueTotal : 0;
        if (amount > lendable) revert InsufficientLiquidity(amount, lendable);

        totalBorrowed += amount;
        asset.safeTransfer(recipient, amount);

        emit DrawFunded(borrowerId, recipient, amount);
    }

    /**
     * Records a repayment already transferred in.
     *
     * The transfer happens at the router; this is the accounting entry.
     * Interest is not subtracted from `totalBorrowed` — it is vault income,
     * and lifting the share price is exactly how providers are paid.
     */
    function receiveRepayment(bytes32 borrowerId, uint256 principal, uint256 interest)
        external
        nonReentrant
        onlyRole(CREDIT_MANAGER_ROLE)
    {
        totalBorrowed = totalBorrowed > principal ? totalBorrowed - principal : 0;
        totalInterestReceived += interest;

        _fundQueue();

        emit RepaymentReceived(borrowerId, principal, interest);
    }

    /**
     * Writes off principal.
     *
     * Socialised across every share by reducing `totalBorrowed`, which lowers
     * the share price for everyone including queued providers — a queued exit
     * still bears its proportional share of a loss realised before the claim.
     */
    function recordLoss(bytes32 borrowerId, uint256 amount)
        external
        nonReentrant
        onlyRole(RISK_ROLE)
    {
        if (amount == 0) revert ZeroAmount();

        totalBorrowed = totalBorrowed > amount ? totalBorrowed - amount : 0;
        totalLosses += amount;

        emit LossRecorded(borrowerId, amount);
    }

    /**
     * Funds queued exits from idle liquidity, oldest first.
     *
     * Called on every repayment. Bounded to a fixed number of entries per call
     * so a long queue cannot make repayment run out of gas — the remainder is
     * funded by the next repayment.
     */
    function _fundQueue() private {
        uint256 liquid = availableLiquidity();
        uint256 processed;

        while (queueHead < _queue.length && processed < 16) {
            QueueEntry storage entry = _queue[queueHead];

            if (entry.claimed || entry.funded >= entry.amount) {
                queueHead += 1;
                processed += 1;
                continue;
            }

            uint256 outstanding = entry.amount - entry.funded;
            uint256 fundable = liquid > outstanding ? outstanding : liquid;
            if (fundable == 0) break;

            entry.funded += fundable;
            liquid -= fundable;
            emit QueueEntryFunded(queueHead, fundable);

            if (entry.funded < entry.amount) break;

            queueHead += 1;
            processed += 1;
        }
    }

    /// Claims the funded portion of a queued exit.
    function claimQueued(uint256 index) external nonReentrant returns (uint256 amount) {
        QueueEntry storage entry = _queue[index];
        if (entry.owner != msg.sender) revert NotQueueOwner();

        amount = entry.funded;
        if (amount == 0 || entry.claimed) revert NothingToClaim();

        entry.claimed = entry.funded >= entry.amount;
        entry.funded = 0;
        queueTotal = queueTotal > amount ? queueTotal - amount : 0;

        asset.safeTransfer(msg.sender, amount);
        emit QueueEntryClaimed(index, msg.sender, amount);
    }

    function queueLength() external view returns (uint256) {
        return _queue.length;
    }

    function queueEntry(uint256 index) external view returns (QueueEntry memory) {
        return _queue[index];
    }

    /// Stops deposits, withdrawals and new draws. Repayments and loss recording
    /// stay open — a paused vault must still be able to take money in.
    function pause() external onlyRole(RISK_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(RISK_ROLE) {
        _unpause();
    }
}
