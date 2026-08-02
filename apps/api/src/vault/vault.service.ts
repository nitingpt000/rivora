import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { borrowerRate, dailyRepaymentCapacity, planWithdrawal, utilization } from '@rivora/core';

import { dec, shares8, toNumber, usdc6 } from '../common/decimal';
import { LedgerError } from '../common/ledger.error';
import type { MutationResultDto, SnapshotOnlyResultDto } from '../contracts/operations.dto';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotService } from '../snapshot/snapshot.service';
import type { VaultPerformanceDto, VaultPortfolioDto } from './vault.dto';

/**
 * Liquidity-provider money movement.
 *
 * The withdrawal path is the interesting one: it serves what liquidity above
 * the buffer floor allows and queues the rest, so a successful response can
 * legitimately report less than was asked for. That is a protocol rule, not an
 * error, which is why it comes back as a receipt with a `queued` figure rather
 * than a rejection.
 */
@Injectable()
export class VaultService {
  constructor(
    private readonly snapshots: SnapshotService,
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Protocol-wide outstanding principal, summed across every borrower.
   *
   * Utilization has to move with the whole book, not with one borrower —
   * otherwise the LP surface and the borrower surface would tell contradictory
   * stories about the same vault.
   */
  static async outstandingPrincipal(client: Prisma.TransactionClient): Promise<number> {
    const total = await client.creditLine.aggregate({ _sum: { principal: true } });
    return toNumber(total._sum.principal ?? 0);
  }

  async deposit(amount: number): Promise<MutationResultDto> {
    return this.ledger.run(async (tx) => {
      const state = await this.snapshots.loadState(tx);
      const { lp, vault } = state;

      const balance = toNumber(lp.walletBalance);
      if (amount > balance + 1e-9) {
        throw new LedgerError(
          `Wallet balance of ${balance.toFixed(2)} USDC is insufficient.`,
          'insufficient_balance',
        );
      }

      const sharePrice = toNumber(vault.sharePrice);
      const minted = shares8(dec(amount).dividedBy(dec(sharePrice)));
      const moved = usdc6(dec(amount));
      const txHash = await this.ledger.nextTxHash(tx);

      await tx.lpPosition.update({
        where: { id: lp.id },
        data: {
          walletBalance: usdc6(dec(lp.walletBalance).minus(moved)),
          supplied: usdc6(dec(lp.supplied).plus(moved)),
          shares: shares8(dec(lp.shares).plus(minted)),
        },
      });
      await tx.vaultState.update({
        where: { id: vault.id },
        data: {
          totalAssets: usdc6(dec(vault.totalAssets).plus(moved)),
          availableLiquidity: usdc6(dec(vault.availableLiquidity).plus(moved)),
        },
      });

      await this.ledger.recordEvent(tx, {
        type: 'vault.deposit',
        who: lp.address,
        amount: `${moved.toFixed(2)} USDC`,
        txHash,
      });

      return this.result(tx, {
        kind: 'deposit',
        amount: moved.toNumber(),
        shares: minted.toNumber(),
        tx: txHash,
      });
    });
  }

  async withdraw(amount: number): Promise<MutationResultDto> {
    return this.ledger.run(async (tx) => {
      const state = await this.snapshots.loadState(tx);
      const { lp, vault } = state;

      const sharePrice = toNumber(vault.sharePrice);
      const positionValue = toNumber(lp.shares) * sharePrice;

      if (positionValue <= 0) {
        throw new LedgerError('There is no vault position to withdraw.', 'no_position');
      }

      const requested = Math.min(amount, positionValue);
      const outstanding = await VaultService.outstandingPrincipal(tx);
      const liquidity = toNumber(vault.availableLiquidity);
      const assets = toNumber(vault.totalAssets);

      const plan = planWithdrawal(requested, liquidity, assets, utilization(outstanding, liquidity));
      const txHash = await this.ledger.nextTxHash(tx);

      const immediate = usdc6(dec(plan.immediate));
      const queued = usdc6(dec(plan.queued));
      const fee = usdc6(dec(plan.fee));
      const burned = shares8(dec(requested).dividedBy(dec(sharePrice)));

      await tx.lpPosition.update({
        where: { id: lp.id },
        data: {
          walletBalance: usdc6(dec(lp.walletBalance).plus(immediate).minus(fee)),
          shares: shares8(dec(lp.shares).minus(burned)),
          supplied: usdc6(dec(Math.max(0, toNumber(lp.supplied) - requested))),
          queued: usdc6(dec(lp.queued).plus(queued)),
        },
      });
      await tx.vaultState.update({
        where: { id: vault.id },
        data: {
          totalAssets: usdc6(dec(vault.totalAssets).minus(immediate)),
          availableLiquidity: usdc6(dec(vault.availableLiquidity).minus(immediate)),
          queueTotal: usdc6(dec(vault.queueTotal).plus(queued)),
        },
      });

      await this.ledger.recordEvent(tx, {
        type: 'vault.withdraw',
        who: lp.address,
        amount: `${immediate.toFixed(2)} USDC`,
        txHash,
        ...(plan.queued > 0 ? { note: `queued ${queued.toFixed(2)}` } : {}),
      });

      return this.result(tx, {
        kind: 'withdraw',
        amount: immediate.toNumber(),
        queued: queued.toNumber(),
        tx: txHash,
      });
    });
  }

  /** Takes the funded portion of a queued exit. */
  async claimQueue(): Promise<SnapshotOnlyResultDto> {
    return this.ledger.run(async (tx) => {
      const state = await this.snapshots.loadState(tx);
      const { lp, vault } = state;
      const funded = toNumber(lp.queueFunded);

      if (funded <= 0) {
        throw new LedgerError('No funded amount is available to claim.', 'nothing_to_claim');
      }

      const claimed = usdc6(dec(funded));
      await tx.lpPosition.update({
        where: { id: lp.id },
        data: {
          walletBalance: usdc6(dec(lp.walletBalance).plus(claimed)),
          queued: usdc6(dec(Math.max(0, toNumber(lp.queued) - funded))),
          queueFunded: dec(0),
        },
      });
      await tx.vaultState.update({
        where: { id: vault.id },
        data: { queueTotal: usdc6(dec(Math.max(0, toNumber(vault.queueTotal) - funded))) },
      });

      return this.snapshotOnly(tx);
    });
  }

  /** Returns a queued exit to the position. Shares and accrual resume. */
  async cancelQueue(): Promise<SnapshotOnlyResultDto> {
    return this.ledger.run(async (tx) => {
      const state = await this.snapshots.loadState(tx);
      const { lp, vault } = state;
      const queued = toNumber(lp.queued);

      if (queued <= 0) {
        throw new LedgerError('There is no queued withdrawal to cancel.', 'nothing_queued');
      }

      const restored = shares8(dec(queued).dividedBy(dec(vault.sharePrice)));
      await tx.lpPosition.update({
        where: { id: lp.id },
        data: {
          shares: shares8(dec(lp.shares).plus(restored)),
          queued: dec(0),
          queueFunded: dec(0),
        },
      });
      await tx.vaultState.update({
        where: { id: vault.id },
        data: { queueTotal: usdc6(dec(Math.max(0, toNumber(vault.queueTotal) - queued))) },
      });

      return this.snapshotOnly(tx);
    });
  }

  /** The caller's position, valued at the current share price. */
  async portfolio(): Promise<VaultPortfolioDto> {
    const state = await this.snapshots.loadState();
    const { lp, vault } = state;

    const sharePrice = toNumber(vault.sharePrice);
    const shares = toNumber(lp.shares);
    const value = shares * sharePrice;
    const supplied = toNumber(lp.supplied);
    const assets = toNumber(vault.totalAssets);

    return {
      address: lp.address,
      shares,
      sharePrice,
      value,
      supplied,
      // May be negative once losses are realised. Reported as computed rather
      // than floored at zero: a vault that cannot show a loss is not a vault.
      earned: value - supplied,
      walletBalance: toNumber(lp.walletBalance),
      queued: toNumber(lp.queued),
      queueFunded: toNumber(lp.queueFunded),
      shareOfVaultPct: assets > 0 ? Math.round((value / assets) * 1000) / 10 : 0,
    };
  }

  /**
   * Yield, decomposed.
   *
   * Organic and subsidised yield are reported separately because a single
   * blended APY overstates what the vault actually earns, and the subsidy has
   * an end date a depositor is entitled to know before committing.
   */
  async performance(): Promise<VaultPerformanceDto> {
    const state = await this.snapshots.loadState();
    const { vault } = state;

    const outstanding = await VaultService.outstandingPrincipal(this.prisma);

    const [paybackDays, concentration] = await Promise.all([
      this.meanPaybackDays(),
      this.concentration(outstanding),
    ]);

    return { ...VaultService.economics(vault, outstanding, paybackDays), ...concentration };
  }

  /**
   * Where the book's principal sits, by sector and by upstream provider.
   *
   * On the LP surface because an LP funds the whole book: its concentration is
   * theirs, and a position that looks diversified across ten borrowers is not
   * diversified if all ten resell the same model provider.
   */
  private async concentration(outstanding: number) {
    const [borrowers, upstream] = await Promise.all([
      this.prisma.borrower.findMany({
        select: { category: true, custody: true, creditLine: { select: { principal: true } } },
      }),
      this.prisma.upstreamDependency.findMany({
        select: {
          name: true,
          category: true,
          sharePct: true,
          substitutable: true,
          borrower: { select: { creditLine: { select: { principal: true } } } },
        },
      }),
    ]);

    const sectors = new Map<string, number>();
    const custody = new Map<string, number>();
    for (const borrower of borrowers) {
      const principal = toNumber(borrower.creditLine?.principal ?? 0);
      sectors.set(borrower.category, (sectors.get(borrower.category) ?? 0) + principal);
      custody.set(borrower.custody, (custody.get(borrower.custody) ?? 0) + principal);
    }

    const providers = new Map<
      string,
      { category: string; principal: number; substitutable: boolean }
    >();
    for (const row of upstream) {
      const current = providers.get(row.name);
      // Principal exposed through a provider is the borrower's principal
      // weighted by how much of their delivery depends on it.
      const exposed = toNumber(row.borrower.creditLine?.principal ?? 0) * (row.sharePct / 100);

      providers.set(row.name, {
        category: row.category,
        principal: (current?.principal ?? 0) + exposed,
        // One non-substitutable borrower makes the whole dependency rigid.
        substitutable: (current?.substitutable ?? true) && row.substitutable,
      });
    }

    return {
      // Every model listed, including the empty ones: an absent row would read
      // as "no data" rather than as "nobody is on this model".
      byCustody: (['A', 'B', 'C'] as const).map((model) => {
        const principal = custody.get(model) ?? 0;
        return {
          model,
          principal,
          sharePct: outstanding > 0 ? Math.round((principal / outstanding) * 1000) / 10 : 0,
        };
      }),

      bySector: [...sectors.entries()]
        .map(([sector, principal]) => {
          const sharePct = outstanding > 0 ? Math.round((principal / outstanding) * 1000) / 10 : 0;
          return {
            sector,
            principal,
            sharePct,
            capPct: SECTOR_CAP_PCT,
            breached: sharePct > SECTOR_CAP_PCT,
          };
        })
        .sort((a, b) => b.principal - a.principal),

      upstream: [...providers.entries()]
        .map(([name, provider]) => ({
          name,
          category: provider.category,
          principal: Math.round(provider.principal * 100) / 100,
          sharePct: outstanding > 0 ? Math.round((provider.principal / outstanding) * 1000) / 10 : 0,
          substitutable: provider.substitutable,
        }))
        .sort((a, b) => b.principal - a.principal),
    };
  }

  /**
   * Yield and coverage, computed from the book.
   *
   * Static except for the subsidy, which is protocol configuration: it is a
   * decision about incentives rather than a measurement of the book, and it
   * has an end date a depositor is entitled to see before committing.
   *
   * Shared with the public stats endpoint so the landing page and the LP
   * surface cannot quote different APYs for the same vault.
   */
  static economics(
    vault: Prisma.VaultStateGetPayload<object>,
    outstandingPrincipal: number,
    weightedMeanPaybackDays: number,
  ): Omit<VaultPerformanceDto, 'byCustody' | 'bySector' | 'upstream'> {
    const assets = toNumber(vault.totalAssets);
    const liquidity = toNumber(vault.availableLiquidity);
    const realized = toNumber(vault.realizedLosses);
    const firstLoss = toNumber(vault.firstLossTranche);
    const interest = toNumber(vault.interestGenerated);

    const u = utilization(outstandingPrincipal, liquidity);
    // `borrowerRate` is already a percentage. PRD §15.2.
    const blendedBorrowerRatePct = borrowerRate(u, 'Standard');

    // What the vault earns is the borrower rate less the protocol's cut,
    // earned only on the deployed share of assets.
    const deployed = assets > 0 ? outstandingPrincipal / assets : 0;
    const organicApyPct =
      round2(blendedBorrowerRatePct * deployed * (1 - vault.protocolSpreadPct / 100));

    const subsidyApyPct = subsidyActive(vault.subsidyEnds) ? vault.subsidyApyPct : 0;

    return {
      displayedApyPct: round2(organicApyPct + subsidyApyPct),
      organicApyPct,
      subsidyApyPct,
      subsidyEnds: vault.subsidyEnds ? vault.subsidyEnds.toISOString() : '',
      blendedBorrowerRatePct: round2(blendedBorrowerRatePct),
      protocolSpreadPct: vault.protocolSpreadPct,
      interestGenerated: toNumber(vault.interestGenerated),
      realizedLosses: realized,
      // Against realised losses once there are any; against outstanding
      // principal before that, since dividing by zero would report infinite
      // coverage on a vault that has simply not been tested yet.
      coverageMultiple:
        realized > 0
          ? Math.round((firstLoss / realized) * 10) / 10
          : Math.round((firstLoss / Math.max(1, outstandingPrincipal)) * 1000) / 10,
      weightedMeanPaybackDays,

      protocolSpreadTaken: round2(interest * (vault.protocolSpreadPct / 100)),
      // What the subsidy has cost so far, at the current rate over the assets
      // that earned it. An approximation until subsidy payments are booked as
      // their own ledger rows.
      subsidyPaidIn: round2((assets * subsidyApyPct) / 100 / 12),
      netToLps: round2(
        interest * (1 - vault.protocolSpreadPct / 100) + (assets * subsidyApyPct) / 100 / 12,
      ),
      principalOriginated: round2(toNumber(vault.principalRepaid) + outstandingPrincipal),
    };
  }

  /**
   * Principal-weighted mean days to repay at current routed revenue.
   *
   * Weighted rather than averaged: a 10 USDC line repaying in three days does
   * not offset a 5,000 USDC line taking ninety.
   */
  private async meanPaybackDays(): Promise<number> {
    const lines = await this.prisma.creditLine.findMany({
      where: { principal: { gt: 0 } },
      select: {
        principal: true,
        repaymentBps: true,
        borrower: { select: { revenueWindow: { select: { dailyMean: true } } } },
      },
    });

    let weighted = 0;
    let total = 0;

    for (const line of lines) {
      const principal = toNumber(line.principal);
      const daily = toNumber(line.borrower.revenueWindow?.dailyMean ?? 0);
      const capacity = dailyRepaymentCapacity(daily, line.repaymentBps);
      if (capacity <= 0) continue;

      weighted += principal * (principal / capacity);
      total += principal;
    }

    return total > 0 ? Math.round(weighted / total) : 0;
  }

  private async result(
    tx: Prisma.TransactionClient,
    receipt: MutationResultDto['receipt'],
  ): Promise<MutationResultDto> {
    const { snapshot } = await this.snapshotOnly(tx);
    return { receipt, snapshot };
  }

  private async snapshotOnly(tx: Prisma.TransactionClient): Promise<SnapshotOnlyResultDto> {
    const [state, events, alerts] = await Promise.all([
      this.snapshots.loadState(tx),
      this.snapshots.recentEvents(tx),
      this.snapshots.recentAlerts(tx),
    ]);
    return { snapshot: this.snapshots.project(state, events, alerts) };
  }
}

/** Sector share above which new draws in that sector are blocked. */
const SECTOR_CAP_PCT = 40;

/** True while the incentive subsidy is still being paid. */
function subsidyActive(ends: Date | null): boolean {
  return ends !== null && ends.getTime() > Date.now();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
