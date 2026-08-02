// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {RepaymentApplication, WithdrawalPlan, RivoraConstants} from "./RivoraTypes.sol";

/**
 * The protocol's arithmetic.
 *
 * A deliberate second implementation of the functions in
 * `packages/core/src/repayment.ts`, `draw.ts` and `vault.ts`. The borrower is
 * shown a preview computed by the TypeScript before signing; the chain then
 * computes the real thing. If the two disagree, the number the borrower
 * consented to was not the number that executed.
 *
 * `test/Differential.t.sol` pins them together against fixtures generated
 * from the TypeScript, so a change to either side that breaks agreement fails
 * the build rather than surfacing as a reconciliation problem later.
 *
 * Pure and library-only: no storage, no external calls, nothing to reenter.
 */
library RivoraMath {
    /**
     * Applies a repayment, interest first.
     *
     * Interest before principal is not a preference — it is what keeps the
     * accrued balance from compounding while a borrower pays down principal,
     * and it is the order the borrower is shown on the repay screen.
     */
    function applyRepayment(uint256 amount, uint256 principal, uint256 accruedInterest)
        internal
        pure
        returns (RepaymentApplication memory)
    {
        uint256 owed = principal + accruedInterest;
        uint256 applied = amount > owed ? owed : amount;

        uint256 toInterest = applied > accruedInterest ? accruedInterest : applied;
        uint256 toPrincipal = applied - toInterest;

        return RepaymentApplication({
            // The amount *requested*, not the amount applied — matching the
            // core package, where `excess` carries what comes back. Callers
            // must therefore move `toInterest + toPrincipal`, never `amount`,
            // or an overpayment is silently kept by the protocol.
            amount: amount,
            toInterest: toInterest,
            toPrincipal: toPrincipal,
            excess: amount - applied,
            // Compared against the whole debt, not against principal alone: a
            // payment that clears principal but leaves interest has not
            // cleared the loan.
            clearsDebt: applied >= owed && owed > 0
        });
    }

    /**
     * Credit available to draw right now.
     *
     * Saturating at zero rather than reverting on an underflow: a borrower
     * whose principal exceeds their limit — possible after a limit reduction —
     * has no capacity, which is a state to report, not an error.
     */
    function availableCredit(uint256 limit, uint256 principal, uint256 pendingDraws)
        internal
        pure
        returns (uint256)
    {
        uint256 used = principal + pendingDraws;
        return limit > used ? limit - used : 0;
    }

    /// Utilization in basis points. Zero when the book is empty.
    function utilizationBps(uint256 outstanding, uint256 availableLiquidity)
        internal
        pure
        returns (uint256)
    {
        uint256 total = outstanding + availableLiquidity;
        if (total == 0) return 0;
        return (outstanding * RivoraConstants.BPS) / total;
    }

    /**
     * The exit fee, in basis points.
     *
     * Zero below the threshold, then rising linearly to the maximum at the
     * ceiling. It exists so that exiting a vault under stress carries a cost
     * that accrues to the providers who stayed, rather than being free to the
     * first mover.
     */
    function withdrawalFeeBps(uint256 utilBps) internal pure returns (uint256) {
        if (utilBps <= RivoraConstants.FEE_THRESHOLD_BPS) return 0;
        if (utilBps >= RivoraConstants.FEE_CEILING_BPS) {
            return RivoraConstants.MAX_WITHDRAWAL_FEE_BPS;
        }

        uint256 span = RivoraConstants.FEE_CEILING_BPS - RivoraConstants.FEE_THRESHOLD_BPS;
        uint256 into = utilBps - RivoraConstants.FEE_THRESHOLD_BPS;
        return (into * RivoraConstants.MAX_WITHDRAWAL_FEE_BPS) / span;
    }

    /**
     * Plans a withdrawal against the buffer floor.
     *
     * Serves what sits above the floor and queues the rest. The floor is a
     * share of *total assets*, not of liquidity, so a vault cannot lend itself
     * into a position where the buffer is trivially satisfied.
     */
    function planWithdrawal(
        uint256 requested,
        uint256 availableLiquidity,
        uint256 totalAssets,
        uint256 utilBps
    ) internal pure returns (WithdrawalPlan memory) {
        uint256 bufferFloor = (totalAssets * RivoraConstants.BUFFER_FLOOR_BPS) / RivoraConstants.BPS;
        uint256 availableNow =
            availableLiquidity > bufferFloor ? availableLiquidity - bufferFloor : 0;

        uint256 immediate = requested > availableNow ? availableNow : requested;
        uint256 queued = requested - immediate;
        uint256 fee = (immediate * withdrawalFeeBps(utilBps)) / RivoraConstants.BPS;

        return WithdrawalPlan({
            requested: requested,
            immediate: immediate,
            queued: queued,
            fee: fee,
            bufferFloor: bufferFloor,
            availableNow: availableNow
        });
    }

    /**
     * Splits a settled revenue batch three ways.
     *
     * The operating share is computed as the remainder rather than as its own
     * percentage, so the three parts always sum to exactly the input. Deriving
     * it independently would leave dust stranded in the router on most inputs.
     */
    function splitRevenue(uint256 amount, uint256 repaymentBps, uint256 reserveBps)
        internal
        pure
        returns (uint256 toRepayment, uint256 toReserve, uint256 toOperating)
    {
        toRepayment = (amount * repaymentBps) / RivoraConstants.BPS;
        toReserve = (amount * reserveBps) / RivoraConstants.BPS;
        toOperating = amount - toRepayment - toReserve;
    }

    /**
     * Interest accrued over `elapsed` seconds at `rateBps` annualised.
     *
     * Simple interest on the current balance, compounded only by how often
     * this is called. A closed-form continuous compound would be more precise
     * and far harder for a borrower to check against their own arithmetic.
     */
    function accrueInterest(uint256 balance, uint256 rateBps, uint256 elapsed)
        internal
        pure
        returns (uint256)
    {
        if (balance == 0 || rateBps == 0 || elapsed == 0) return 0;
        return (balance * rateBps * elapsed) / (RivoraConstants.BPS * 365 days);
    }
}
