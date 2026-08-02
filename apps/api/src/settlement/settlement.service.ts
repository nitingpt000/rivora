import { Injectable } from '@nestjs/common';
import { applyRepayment, borrowerRate, dailyInterest, utilization } from '@rivora/core';

import { dec, shares8, toNumber, usdc6 } from '../common/decimal';
import type { SnapshotOnlyResultDto } from '../contracts/operations.dto';
import { LedgerService } from '../ledger/ledger.service';
import { SnapshotService } from '../snapshot/snapshot.service';
import { VaultService } from '../vault/vault.service';

/** Queue funding rate per settlement day, USDC. PRD §23.4. */
const QUEUE_FUNDING_PER_DAY = 186.34;

/**
 * One settlement day.
 *
 * Accrues interest, routes the repayment share of settled revenue through the
 * waterfall, tops up the loss reserve and funds the withdrawal queue.
 *
 * This is a keeper concern, not a user action — nothing anyone clicks should
 * move the protocol clock. It is exposed as an endpoint so a scheduler can
 * call it, and deliberately has no UI.
 */
@Injectable()
export class SettlementService {
  constructor(
    private readonly snapshots: SnapshotService,
    private readonly ledger: LedgerService,
  ) {}

  async tick(): Promise<SnapshotOnlyResultDto> {
    return this.ledger.run(async (tx) => {
      const state = await this.snapshots.loadState(tx);
      const credit = state.creditLine!;
      const revenue = state.revenueWindow!;
      const { vault } = state;

      const outstanding = await VaultService.outstandingPrincipal(tx);
      const liquidity = toNumber(vault.availableLiquidity);
      const rate = borrowerRate(utilization(outstanding, liquidity), credit.tier);

      let principal = toNumber(credit.principal);
      let interest = toNumber(credit.accruedInterest);
      const hadDebt = principal > 0;

      const accrued = dailyInterest(principal + interest, rate);
      if (hadDebt) interest += accrued;

      let repaidPrincipal = 0;
      let returnedToVault = 0;
      let status = credit.status;
      let completedCycles = credit.completedCycles;

      if (principal > 0 || interest > 0) {
        const budget = (toNumber(revenue.dailyMean) * credit.repaymentBps) / 10_000;
        const applied = applyRepayment(budget, principal, interest);

        interest = Math.max(0, interest - applied.toInterest);
        principal = Math.max(0, principal - applied.toPrincipal);
        repaidPrincipal = applied.toPrincipal;
        returnedToVault = applied.toInterest + applied.toPrincipal;

        if (principal < 0.005 && hadDebt && status === 'ACTIVE') {
          status = 'REPAID';
          completedCycles += 1;
        }
      }

      const reserveTarget = toNumber(credit.reserveTarget);
      const reserve = Math.min(
        reserveTarget,
        toNumber(credit.reserve) + (toNumber(revenue.dailyMean) * credit.reserveBps) / 10_000,
      );

      await tx.creditLine.update({
        where: { id: credit.id },
        data: {
          principal: usdc6(dec(principal)),
          accruedInterest: usdc6(dec(interest)),
          principalRepaid: usdc6(dec(credit.principalRepaid).plus(dec(repaidPrincipal))),
          reserve: usdc6(dec(reserve)),
          historyDays: credit.historyDays + 1,
          status,
          completedCycles,
        },
      });

      // Share price compounds on the interest actually earned by the book: the
      // borrower rate net of the protocol spread, which is 35% of it.
      const nextSharePrice = dec(vault.sharePrice).times(
        dec((1 + (rate / 100) * 0.35) ** (1 / 365)),
      );

      await tx.vaultState.update({
        where: { id: vault.id },
        data: {
          day: vault.day + 1,
          availableLiquidity: usdc6(dec(vault.availableLiquidity).plus(dec(returnedToVault))),
          principalRepaid: usdc6(dec(vault.principalRepaid).plus(dec(repaidPrincipal))),
          interestGenerated: usdc6(dec(vault.interestGenerated).plus(dec(accrued))),
          sharePrice: shares8(nextSharePrice),
        },
      });

      // Queued exits are funded from incoming repayments, ahead of any new
      // borrower draw.
      const lp = state.lp;
      const queued = toNumber(lp.queued);
      const funded = toNumber(lp.queueFunded);
      if (queued > funded) {
        await tx.lpPosition.update({
          where: { id: lp.id },
          data: {
            queueFunded: usdc6(
              dec(funded).plus(dec(Math.min(QUEUE_FUNDING_PER_DAY, queued - funded))),
            ),
          },
        });
      }

      const txHash = await this.ledger.nextTxHash(tx);
      await this.ledger.recordEvent(tx, {
        type: 'settlement.completed',
        who: state.handle,
        amount: `${returnedToVault.toFixed(2)} USDC`,
        txHash,
        note: `day ${vault.day + 1} · interest ${accrued.toFixed(2)} · principal ${repaidPrincipal.toFixed(2)}`,
        borrowerId: state.id,
      });

      const [next, events, alerts] = await Promise.all([
        this.snapshots.loadState(tx),
        this.snapshots.recentEvents(tx),
        this.snapshots.recentAlerts(tx),
      ]);

      return { snapshot: this.snapshots.project(next, events, alerts) };
    });
  }
}
