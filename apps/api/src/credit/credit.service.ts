import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  applyRepayment,
  availableCredit,
  canBorrow,
  evaluateSpend,
  type SpendDecision,
} from '@rivora/core';

import { ChainService } from '../chain/chain.service';
import { dec, toNumber, usdc6 } from '../common/decimal';
import { LedgerError } from '../common/ledger.error';
import type { MutationResultDto } from '../contracts/operations.dto';
import { LedgerService } from '../ledger/ledger.service';
import { SnapshotService, type LedgerState } from '../snapshot/snapshot.service';

/**
 * Thrown when the spending policy refuses a draw.
 *
 * Carries the decision row so the caller can write it after the transaction
 * has rolled back. Internal to this file — callers see a `LedgerError`.
 */
class PolicyRefusal extends Error {
  constructor(
    readonly decision: SpendDecision,
    readonly row: Prisma.PolicyDecisionUncheckedCreateInput,
  ) {
    super(decision.reason);
    this.name = 'PolicyRefusal';
  }
}

/**
 * Borrower money movement.
 *
 * Every capacity, status and liquidity check lives here rather than in the
 * client that calls it. A guard in a dialog is a hint; this is the boundary
 * that has to hold, and it is the reason a draw for more than the available
 * limit comes back as a refusal rather than a surprise.
 *
 * The arithmetic itself is `@rivora/core` — the same functions the web app
 * uses to *preview* a draw. Two implementations of `applyRepayment` would
 * eventually disagree, and the one the borrower saw would be the wrong one.
 *
 * Amounts round-trip through `number` to reach those pure functions and are
 * rounded back to six places before storage. Safe at these magnitudes: a USDC
 * figure below a billion needs 15 significant digits, inside a double's exact
 * range, and `usdc6` pins the result to what the column can hold.
 */
@Injectable()
export class CreditService {
  constructor(
    private readonly snapshots: SnapshotService,
    private readonly ledger: LedgerService,
    private readonly chain: ChainService,
  ) {}

  /** Credit available to draw right now. */
  static capacityOf(state: LedgerState): number {
    const credit = state.creditLine;
    if (!credit) return 0;
    return availableCredit(
      toNumber(credit.limitAmount),
      toNumber(credit.principal),
      toNumber(credit.pendingDraws),
    );
  }

  async draw(amount: number, category: string): Promise<MutationResultDto> {
    try {
      return await this.drawInTransaction(amount, category);
    } catch (cause) {
      /**
       * A refused draw still has to leave a record.
       *
       * The decision row is written inside the draw's transaction, which a
       * refusal rolls back — so a rejection recorded there would vanish with
       * the draw it refused, and the audit log would show only approvals.
       * Rewriting it in its own transaction afterwards is what makes the
       * refusal survive.
       */
      if (cause instanceof PolicyRefusal) {
        await this.ledger.run((tx) => tx.policyDecision.create({ data: cause.row }));
        throw new LedgerError(cause.decision.reason, cause.decision.code || 'policy_refused');
      }
      throw cause;
    }
  }

  private async drawInTransaction(amount: number, category: string): Promise<MutationResultDto> {
    return this.ledger.run(async (tx) => {
      const state = await this.snapshots.loadState(tx);
      const credit = state.creditLine!;
      const capacity = CreditService.capacityOf(state);

      if (!canBorrow(credit.status, capacity)) {
        throw new LedgerError(
          `Draws are blocked while the account is ${credit.status}.`,
          'draws_blocked',
        );
      }
      if (amount > capacity + 1e-9) {
        throw new LedgerError(
          `Requested ${amount.toFixed(2)} exceeds available credit of ${capacity.toFixed(2)}.`,
          'exceeds_available',
        );
      }

      const liquidity = toNumber(state.vault.availableLiquidity);
      if (amount > liquidity) {
        throw new LedgerError(
          'Vault liquidity is insufficient for this draw.',
          'insufficient_liquidity',
        );
      }

      // The agent spending policy, enforced rather than displayed. Every
      // outcome is recorded, refusals included: a policy nobody can audit
      // after the fact is indistinguishable from no policy.
      await this.enforcePolicy(tx, state.id, state.operatingWallet, amount, category);

      // Broadcast after every refusal has had its chance and before any row
      // moves: a rejected draw must never reach the chain, and a broadcast
      // one must not be recorded differently from how it settled. In arc
      // mode the Manager pays the operating wallet it has registered.
      const settlement = await this.chain.fundDraw({
        borrowerHandle: state.handle,
        amount,
        recipient: state.operatingWallet,
      });
      const txHash = settlement.txHash;
      const moved = usdc6(dec(amount));

      await tx.creditLine.update({
        where: { id: credit.id },
        data: { principal: usdc6(dec(credit.principal).plus(moved)) },
      });
      await tx.vaultState.update({
        where: { id: state.vault.id },
        data: { availableLiquidity: usdc6(dec(state.vault.availableLiquidity).minus(moved)) },
      });

      await this.ledger.recordEvent(tx, {
        type: 'credit.draw.completed',
        who: state.handle,
        amount: `${moved.toFixed(2)} USDC`,
        txHash,
        note: category,
        borrowerId: state.id,
      });
      await this.ledger.recordAlert(tx, {
        icon: '✓',
        title: 'Draw completed',
        body: `${moved.toFixed(2)} USDC to ${state.operatingWallet}`,
        txHash,
        borrowerId: state.id,
      });

      return this.result(tx, { kind: 'draw', amount: moved.toNumber(), tx: txHash });
    });
  }

  /**
   * Evaluates the agent spending policy and records the outcome.
   *
   * Called inside the draw transaction, so a refusal rolls back with
   * everything else and an approval increments the day's spend in the same
   * write that moves the money — two draws racing cannot both fit under a
   * cap that only one of them had room for.
   *
   * `spentToday` resets on the calendar day rather than by a job: a counter
   * that needs a keeper to be honest is a counter that is wrong whenever the
   * keeper is late.
   *
   * The allowlist is deliberately not consulted here. It governs payments the
   * agent makes *out of* the operating wallet, and a draw's destination is
   * the operating wallet itself — checking it would be a check that can never
   * fail, which is worse than no check because it reads like one.
   */
  private async enforcePolicy(
    tx: Prisma.TransactionClient,
    borrowerId: string,
    recipient: string,
    amount: number,
    category: string,
  ): Promise<void> {
    const policy =
      (await tx.agentPolicy.findUnique({ where: { borrowerId } })) ??
      (await tx.agentPolicy.create({ data: { borrowerId } }));

    const sameDay =
      policy.updatedAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    const spentToday = sameDay ? toNumber(policy.spentToday) : 0;

    const decision = evaluateSpend(
      // A draw is made from an owner-authenticated session, so the owner is
      // the signature the approval threshold asks for.
      { amount, category, ownerAuthorised: true },
      {
        maxPayment: toNumber(policy.maxPayment),
        maxDaily: toNumber(policy.maxDaily),
        spentToday,
        humanApprovalThreshold: toNumber(policy.humanApprovalThreshold),
        allowedCategories: policy.allowedCategories,
        blockedCategories: policy.blockedCategories,
      },
    );

    const row = {
      borrowerId,
      recipient,
      amount: usdc6(dec(amount)),
      category,
      outcome: decision.outcome,
      reason: decision.reason,
    };

    // Carried out of the transaction rather than written inside it: this one
    // has to outlive the rollback it is about to cause.
    if (decision.outcome !== 'allowed') {
      throw new PolicyRefusal(decision, row);
    }

    await tx.policyDecision.create({ data: row });
    await tx.agentPolicy.update({
      where: { id: policy.id },
      data: { spentToday: usdc6(dec(spentToday).plus(dec(amount))) },
    });
  }

  async repay(amount: number): Promise<MutationResultDto> {
    return this.ledger.run(async (tx) => {
      const state = await this.snapshots.loadState(tx);
      const credit = state.creditLine!;

      const principal = toNumber(credit.principal);
      const interest = toNumber(credit.accruedInterest);
      const owed = principal + interest;

      if (owed <= 0.005) {
        throw new LedgerError('There is no outstanding debt to repay.', 'no_debt');
      }

      // Capped rather than refused: overpaying is a reasonable thing to ask
      // for, and the excess simply is not taken.
      const requested = Math.min(amount, owed);
      const applied = applyRepayment(requested, principal, interest);

      const settlement = await this.chain.receiveRepayment({
        borrowerHandle: state.handle,
        principal: applied.toPrincipal,
        interest: applied.toInterest,
      });
      const txHash = settlement.txHash;

      const returned = usdc6(dec(applied.toInterest).plus(applied.toPrincipal));

      await tx.creditLine.update({
        where: { id: credit.id },
        data: {
          accruedInterest: usdc6(dec(Math.max(0, interest - applied.toInterest))),
          principal: usdc6(dec(Math.max(0, principal - applied.toPrincipal))),
          principalRepaid: usdc6(dec(credit.principalRepaid).plus(dec(applied.toPrincipal))),
          ...(applied.clearsDebt
            ? {
                completedCycles: credit.completedCycles + 1,
                ...(credit.status === 'ACTIVE' ? { status: 'REPAID' as const } : {}),
              }
            : {}),
        },
      });

      await tx.vaultState.update({
        where: { id: state.vault.id },
        data: {
          availableLiquidity: usdc6(dec(state.vault.availableLiquidity).plus(returned)),
          principalRepaid: usdc6(dec(state.vault.principalRepaid).plus(dec(applied.toPrincipal))),
        },
      });

      await this.ledger.recordEvent(tx, {
        type: 'credit.repayment.completed',
        who: state.handle,
        amount: `${requested.toFixed(2)} USDC`,
        txHash,
        note: `interest ${applied.toInterest.toFixed(2)} · principal ${applied.toPrincipal.toFixed(2)}`,
        borrowerId: state.id,
      });
      await this.ledger.recordAlert(tx, {
        icon: '✓',
        title: applied.clearsDebt ? 'Credit line fully repaid' : 'Repayment applied',
        body: `${requested.toFixed(2)} USDC — interest ${applied.toInterest.toFixed(2)}, principal ${applied.toPrincipal.toFixed(2)}`,
        txHash,
        borrowerId: state.id,
      });

      return this.result(tx, {
        kind: 'repay',
        amount: requested,
        clearsDebt: applied.clearsDebt,
        tx: txHash,
      });
    });
  }

  /** Re-reads the book inside the same transaction so the receipt and the
   *  snapshot it ships with describe the same instant. */
  private async result(
    tx: Parameters<Parameters<LedgerService['run']>[0]>[0],
    receipt: MutationResultDto['receipt'],
  ): Promise<MutationResultDto> {
    const [state, events, alerts] = await Promise.all([
      this.snapshots.loadState(tx),
      this.snapshots.recentEvents(tx),
      this.snapshots.recentAlerts(tx),
    ]);
    return { receipt, snapshot: this.snapshots.project(state, events, alerts) };
  }
}
