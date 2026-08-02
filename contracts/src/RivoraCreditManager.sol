// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {RivoraCreditVault} from "./RivoraCreditVault.sol";
import {RivoraRiskRegistry} from "./RivoraRiskRegistry.sol";
import {RivoraMath} from "./RivoraMath.sol";
import {BorrowerStatus, Tier, RepaymentApplication, RivoraConstants} from "./RivoraTypes.sol";

/**
 * Borrower accounts, limits and debt.
 *
 * Decides who may draw and how much. Holds no funds — the vault does — so a
 * bug here cannot drain liquidity directly, only mis-authorise a draw against
 * a limit.
 *
 * ## Where limits come from
 *
 * This contract never computes a limit. It reads the recommendation from the
 * signed assessment in the Risk Registry, which the offchain underwriting
 * engine produced from a revenue history no contract can see. Recomputing the
 * constraint ladder onchain would mean reimplementing `calculateLimit` against
 * inputs the chain does not have, and the two would drift.
 *
 * What it does enforce is that the limit in force is *attributable*: it came
 * from an unexpired assessment signed by an authorised underwriter.
 */
contract RivoraCreditManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// Held by the protocol's keeper — accrues interest, applies repayments.
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    /// Held by risk operators — restricts, declares default.
    bytes32 public constant RISK_ROLE = keccak256("RISK_ROLE");
    /// Held by the router of each borrower, to report routed repayments.
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");

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
        Tier tier;
        BorrowerStatus status;
        uint256 lastAccrualAt;
        uint256 lastAssessmentAt;
        bool exists;
    }

    IERC20 public immutable asset;
    RivoraCreditVault public immutable vault;
    RivoraRiskRegistry public immutable registry;

    mapping(bytes32 borrowerId => BorrowerAccount) private _accounts;
    /// Router address back to borrower, so a router can identify itself.
    mapping(address router => bytes32 borrowerId) public routerToBorrower;

    /// Annualised borrower rate in bps, per tier. Set by governance.
    mapping(Tier tier => uint256 rateBps) public tierRateBps;

    event BorrowerRegistered(bytes32 indexed borrowerId, address indexed owner, address router);
    event LimitUpdated(
        bytes32 indexed borrowerId, uint256 previousLimit, uint256 newLimit, uint256 riskScore
    );
    event Drawn(bytes32 indexed borrowerId, uint256 amount, address recipient);
    event Repaid(
        bytes32 indexed borrowerId,
        uint256 amount,
        uint256 toInterest,
        uint256 toPrincipal,
        bool cleared
    );
    event InterestAccrued(bytes32 indexed borrowerId, uint256 amount, uint256 elapsed);
    event StatusChanged(
        bytes32 indexed borrowerId, BorrowerStatus previous, BorrowerStatus current, string reason
    );

    error UnknownBorrower(bytes32 borrowerId);
    error AlreadyRegistered(bytes32 borrowerId);
    error NotBorrowerOwner(address caller);
    error DrawsBlocked(BorrowerStatus status);
    error ExceedsAvailableCredit(uint256 requested, uint256 available);
    error NoOutstandingDebt();
    error RepaymentExceedsDebt(uint256 amount, uint256 owed);
    error ZeroAmount();
    error ZeroAddress();

    constructor(
        IERC20 asset_,
        RivoraCreditVault vault_,
        RivoraRiskRegistry registry_,
        address admin
    ) {
        if (address(asset_) == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }

        asset = asset_;
        vault = vault_;
        registry = registry_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);

        // Base rates by tier, annualised. The full rate model in
        // `@rivora/core` adds a utilization-linked component offchain; what is
        // enforced here is the tier premium.
        tierRateBps[Tier.Prime] = 800;
        tierRateBps[Tier.Strong] = 1_200;
        tierRateBps[Tier.Standard] = 1_600;
        tierRateBps[Tier.Restricted] = 2_400;
        tierRateBps[Tier.Ineligible] = 0;
    }

    function registerBorrower(
        bytes32 borrowerId,
        address owner,
        address revenueRouter,
        address operatingWallet,
        uint256 repaymentBps,
        uint256 reserveBps
    ) external onlyRole(RISK_ROLE) {
        if (_accounts[borrowerId].exists) revert AlreadyRegistered(borrowerId);
        if (owner == address(0) || revenueRouter == address(0) || operatingWallet == address(0)) {
            revert ZeroAddress();
        }

        _accounts[borrowerId] = BorrowerAccount({
            owner: owner,
            revenueRouter: revenueRouter,
            operatingWallet: operatingWallet,
            creditLimit: 0,
            principal: 0,
            accruedInterest: 0,
            repaymentBps: repaymentBps,
            reserveBps: reserveBps,
            riskScore: 0,
            tier: Tier.Standard,
            // Every borrower starts in observation. A limit requires an
            // assessment, and an assessment requires observed revenue.
            status: BorrowerStatus.OBSERVATION,
            lastAccrualAt: block.timestamp,
            lastAssessmentAt: 0,
            exists: true
        });

        routerToBorrower[revenueRouter] = borrowerId;
        _grantRole(ROUTER_ROLE, revenueRouter);

        emit BorrowerRegistered(borrowerId, owner, revenueRouter);
    }

    /**
     * Adopts the limit from the latest signed assessment.
     *
     * Permissionless: the assessment's authority is the underwriter's
     * signature, already checked by the registry, so anyone may push the
     * result on-chain. `latestAssessment` reverts on an expired one, which is
     * what stops a stale favourable limit being adopted later.
     */
    function syncLimitFromRegistry(bytes32 borrowerId) external whenNotPaused {
        BorrowerAccount storage account = _requireAccount(borrowerId);

        RivoraRiskRegistry.RiskAssessment memory assessment = registry.latestAssessment(borrowerId);

        uint256 previous = account.creditLimit;
        account.creditLimit = assessment.recommendedLimit;
        account.riskScore = assessment.riskScore;
        account.tier = assessment.tier;
        account.lastAssessmentAt = block.timestamp;

        // An assessed borrower with a limit leaves observation. A restricted or
        // defaulted one is not rescued by a new assessment — that requires a
        // deliberate risk action.
        if (account.status == BorrowerStatus.OBSERVATION && assessment.recommendedLimit > 0) {
            _setStatus(account, borrowerId, BorrowerStatus.ACTIVE, "first assessment");
        }

        emit LimitUpdated(borrowerId, previous, assessment.recommendedLimit, assessment.riskScore);
    }

    /// Credit available to draw right now.
    function availableCredit(bytes32 borrowerId) public view returns (uint256) {
        BorrowerAccount storage account = _accounts[borrowerId];
        if (!account.exists) return 0;
        return RivoraMath.availableCredit(account.creditLimit, account.principal, 0);
    }

    /**
     * Draws against the limit.
     *
     * Only the borrower's registered owner may call it, and funds go to the
     * registered operating wallet rather than to a caller-supplied address —
     * a compromised owner key should not be able to redirect a draw.
     */
    function draw(bytes32 borrowerId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        BorrowerAccount storage account = _requireAccount(borrowerId);
        if (msg.sender != account.owner) revert NotBorrowerOwner(msg.sender);
        if (amount == 0) revert ZeroAmount();

        _accrue(account, borrowerId);

        if (account.status != BorrowerStatus.ACTIVE && account.status != BorrowerStatus.ELIGIBLE) {
            revert DrawsBlocked(account.status);
        }

        uint256 available = RivoraMath.availableCredit(account.creditLimit, account.principal, 0);
        if (amount > available) revert ExceedsAvailableCredit(amount, available);

        account.principal += amount;
        account.status = BorrowerStatus.ACTIVE;

        vault.fundDraw(borrowerId, amount, account.operatingWallet);

        emit Drawn(borrowerId, amount, account.operatingWallet);
        return amount;
    }

    /**
     * Applies a repayment routed by the borrower's Revenue Router.
     *
     * The router has already transferred the USDC to the vault before calling
     * this, so this is the accounting entry rather than a transfer. Restricted
     * to `ROUTER_ROLE`, and the caller must be *that borrower's* router — a
     * router must not be able to credit somebody else's debt.
     */
    function receiveRepayment(bytes32 borrowerId, uint256 amount)
        external
        nonReentrant
        onlyRole(ROUTER_ROLE)
    {
        if (routerToBorrower[msg.sender] != borrowerId) {
            revert NotBorrowerOwner(msg.sender);
        }
        _applyRepayment(borrowerId, amount);
    }

    /**
     * Direct repayment by the borrower, outside the routed share.
     *
     * Pulls only what is actually applied. Transferring the full requested
     * amount and applying part of it would leave the overpayment sitting in
     * the vault with no owner — the borrower would have paid more than their
     * debt and received nothing back.
     */
    function repay(bytes32 borrowerId, uint256 amount) external nonReentrant whenNotPaused {
        BorrowerAccount storage account = _requireAccount(borrowerId);
        if (msg.sender != account.owner) revert NotBorrowerOwner(msg.sender);
        if (amount == 0) revert ZeroAmount();

        _accrue(account, borrowerId);

        uint256 owed = account.principal + account.accruedInterest;
        if (owed == 0) revert NoOutstandingDebt();

        uint256 toMove = amount > owed ? owed : amount;
        asset.safeTransferFrom(msg.sender, address(vault), toMove);

        _applyRepayment(borrowerId, toMove);
    }

    /**
     * Books a repayment whose funds have already reached the vault.
     *
     * `amount` must be the amount actually transferred, and callers must have
     * capped it at the outstanding debt — this reverts rather than silently
     * absorbing an excess it has no way to return.
     */
    function _applyRepayment(bytes32 borrowerId, uint256 amount) private {
        BorrowerAccount storage account = _requireAccount(borrowerId);

        _accrue(account, borrowerId);

        uint256 owed = account.principal + account.accruedInterest;
        if (owed == 0) revert NoOutstandingDebt();

        RepaymentApplication memory applied =
            RivoraMath.applyRepayment(amount, account.principal, account.accruedInterest);

        if (applied.excess > 0) revert RepaymentExceedsDebt(amount, owed);

        account.accruedInterest -= applied.toInterest;
        account.principal -= applied.toPrincipal;

        if (applied.clearsDebt && account.status == BorrowerStatus.ACTIVE) {
            _setStatus(account, borrowerId, BorrowerStatus.REPAID, "debt cleared");
        }

        vault.receiveRepayment(borrowerId, applied.toPrincipal, applied.toInterest);

        emit Repaid(
            borrowerId,
            applied.toInterest + applied.toPrincipal,
            applied.toInterest,
            applied.toPrincipal,
            applied.clearsDebt
        );
    }

    /// Brings interest up to date. Idempotent within a block.
    function accrue(bytes32 borrowerId) external {
        _accrue(_requireAccount(borrowerId), borrowerId);
    }

    function _accrue(BorrowerAccount storage account, bytes32 borrowerId) private {
        // forge-lint: disable-next-line(block-timestamp)
        uint256 elapsed = block.timestamp - account.lastAccrualAt;
        if (elapsed == 0 || account.principal == 0) {
            account.lastAccrualAt = block.timestamp;
            return;
        }

        uint256 interest = RivoraMath.accrueInterest(
            account.principal + account.accruedInterest, tierRateBps[account.tier], elapsed
        );

        account.accruedInterest += interest;
        account.lastAccrualAt = block.timestamp;

        if (interest > 0) emit InterestAccrued(borrowerId, interest, elapsed);
    }

    /**
     * Restricts a borrower.
     *
     * Sets the limit to zero and escalates the repayment share. Used when the
     * endpoint probe finds the advertised `payTo` no longer matches the bound
     * router — the moment repayment stops being structural.
     */
    function restrict(bytes32 borrowerId, string calldata reason) external onlyRole(RISK_ROLE) {
        BorrowerAccount storage account = _requireAccount(borrowerId);

        account.creditLimit = 0;
        account.repaymentBps = RivoraConstants.ESCALATED_REPAYMENT_BPS;
        _setStatus(account, borrowerId, BorrowerStatus.RESTRICTED, reason);
    }

    function setStatus(bytes32 borrowerId, BorrowerStatus status, string calldata reason)
        external
        onlyRole(RISK_ROLE)
    {
        _setStatus(_requireAccount(borrowerId), borrowerId, status, reason);
    }

    function _setStatus(
        BorrowerAccount storage account,
        bytes32 borrowerId,
        BorrowerStatus status,
        string memory reason
    ) private {
        BorrowerStatus previous = account.status;
        account.status = status;
        emit StatusChanged(borrowerId, previous, status, reason);
    }

    function setTierRate(Tier tier, uint256 rateBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tierRateBps[tier] = rateBps;
    }

    function accountOf(bytes32 borrowerId) external view returns (BorrowerAccount memory) {
        return _accounts[borrowerId];
    }

    /// Debt including interest accrued but not yet written to storage.
    function outstandingDebt(bytes32 borrowerId) external view returns (uint256) {
        BorrowerAccount storage acct = _accounts[borrowerId];
        if (!acct.exists) return 0;

        // forge-lint: disable-next-line(block-timestamp)
        uint256 elapsed = block.timestamp - acct.lastAccrualAt;
        uint256 pending = RivoraMath.accrueInterest(
            acct.principal + acct.accruedInterest, tierRateBps[acct.tier], elapsed
        );

        return acct.principal + acct.accruedInterest + pending;
    }

    function _requireAccount(bytes32 borrowerId) private view returns (BorrowerAccount storage) {
        BorrowerAccount storage acct = _accounts[borrowerId];
        if (!acct.exists) revert UnknownBorrower(borrowerId);
        return acct;
    }

    function pause() external onlyRole(RISK_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(RISK_ROLE) {
        _unpause();
    }
}
