import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { LedgerError } from '../common/ledger.error';
import { shortTime, timeOfDay } from '../common/tx-hash';
import { toNumber } from '../common/decimal';
import type {
  ActivityEventDto,
  AlertDto,
  ProtocolSnapshotDto,
} from '../contracts/snapshot.dto';
import { PrismaService } from '../prisma/prisma.service';

/** Network the book is anchored to. Surfaces in `meta.network`. */
export const NETWORK_NAME = 'Arc Testnet';

/** How many events and alerts a snapshot carries. */
const EVENT_LIMIT = 40;
const ALERT_LIMIT = 40;

/**
 * The borrower, vault and LP rows a snapshot is built from, loaded together.
 *
 * Every write path needs the same graph, so it is fetched once and passed
 * around rather than re-queried per service.
 */
export type LedgerState = Prisma.BorrowerGetPayload<{
  include: { creditLine: true; revenueWindow: true; health: true };
}> & {
  vault: Prisma.VaultStateGetPayload<object>;
  lp: Prisma.LpPositionGetPayload<object>;
};

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the primary borrower with its vault and LP counterparties.
   *
   * The protocol models one book and, for now, one borrower position behind
   * the borrower surface. Selecting the earliest registration keeps that
   * deterministic rather than depending on row order.
   */
  async loadState(client: Prisma.TransactionClient = this.prisma): Promise<LedgerState> {
    const [borrower, vault, lp] = await Promise.all([
      client.borrower.findFirst({
        orderBy: { registeredAt: 'asc' },
        include: { creditLine: true, revenueWindow: true, health: true },
      }),
      client.vaultState.findUnique({ where: { id: 'singleton' } }),
      client.lpPosition.findFirst({ orderBy: { depositedAt: 'asc' } }),
    ]);

    if (!borrower || !borrower.creditLine || !borrower.revenueWindow || !borrower.health) {
      throw new LedgerError(
        'The protocol has no seeded borrower. Run `pnpm --filter @rivora/api db:seed`.',
        'not_seeded',
        503,
      );
    }
    if (!vault) {
      throw new LedgerError(
        'The vault has not been initialised. Run `pnpm --filter @rivora/api db:seed`.',
        'not_seeded',
        503,
      );
    }
    if (!lp) {
      throw new LedgerError(
        'No liquidity-provider position exists. Run `pnpm --filter @rivora/api db:seed`.',
        'not_seeded',
        503,
      );
    }

    return { ...borrower, vault, lp };
  }

  /** One consistent read of all protocol state. */
  async getSnapshot(): Promise<ProtocolSnapshotDto> {
    const state = await this.loadState();
    const [events, alerts] = await Promise.all([this.recentEvents(), this.recentAlerts()]);
    return this.project(state, events, alerts);
  }

  async recentEvents(client: Prisma.TransactionClient = this.prisma): Promise<ActivityEventDto[]> {
    const rows = await client.activityEvent.findMany({
      orderBy: { at: 'desc' },
      take: EVENT_LIMIT,
    });

    return rows.map((row) => ({
      time: timeOfDay(row.at),
      type: row.type,
      who: row.who,
      amount: row.amount,
      tx: row.txHash,
      ...(row.note ? { note: row.note } : {}),
    }));
  }

  async recentAlerts(client: Prisma.TransactionClient = this.prisma): Promise<AlertDto[]> {
    const rows = await client.alert.findMany({ orderBy: { at: 'desc' }, take: ALERT_LIMIT });

    return rows.map((row) => ({
      time: shortTime(row.at),
      icon: row.icon,
      title: row.title,
      unread: row.unread,
      ...(row.body ? { body: row.body } : {}),
      ...(row.txHash ? { tx: row.txHash } : {}),
      ...(row.href ? { href: row.href } : {}),
      ...(row.cta ? { cta: row.cta } : {}),
    }));
  }

  /**
   * Projects the stored rows into the wire contract.
   *
   * The single place decimals become numbers, and the single place the
   * database's shape becomes the API's shape. A schema change lands here and
   * nowhere else.
   */
  project(state: LedgerState, events: ActivityEventDto[], alerts: AlertDto[]): ProtocolSnapshotDto {
    const credit = state.creditLine;
    const revenue = state.revenueWindow;
    const health = state.health;
    const { vault, lp } = state;

    if (!credit || !revenue || !health) {
      throw new LedgerError('Borrower record is incomplete.', 'incomplete_borrower', 503);
    }

    return {
      borrower: {
        id: state.handle,
        status: credit.status,
        tier: credit.tier,
        score: credit.score,
        previousScore: credit.previousScore,
        limit: toNumber(credit.limitAmount),
        previousLimit: toNumber(credit.previousLimit),
        principal: toNumber(credit.principal),
        accruedInterest: toNumber(credit.accruedInterest),
        pendingDraws: toNumber(credit.pendingDraws),
        reserve: toNumber(credit.reserve),
        reserveTarget: toNumber(credit.reserveTarget),
        repaymentBps: credit.repaymentBps,
        reserveBps: credit.reserveBps,
        completedCycles: credit.completedCycles,
        historyDays: credit.historyDays,
        custody: state.custody,
        watchReason: credit.watchReason as '' | 'revenue' | 'concentration',
        restrictReason: credit.restrictReason as '' | 'circular' | 'binding',
        anomalyDetected: credit.anomalyDetected,
      },
      revenue: {
        eligible: toNumber(revenue.eligible),
        gross: toNumber(revenue.gross),
        excluded: toNumber(revenue.excluded),
        dailyMean: toNumber(revenue.dailyMean),
        growthPct: revenue.growthPct,
        largestPayerPct: revenue.largestPayerPct,
        hhi: revenue.hhi,
        uniquePayers: revenue.uniquePayers,
        repeatPayers: revenue.repeatPayers,
      },
      health: {
        coverageRatio: health.coverageRatio,
        uptimePct: health.uptimePct,
        successPct: health.successPct,
        refundRatePct: health.refundRatePct,
        latencyMs: health.latencyMs,
        bindingOk: health.bindingOk,
        endpointUp: health.endpointUp,
        factors: {
          S: health.factorS,
          C: health.factorC,
          V: health.factorV,
          D: health.factorD,
          M: health.factorM,
          G: health.factorG,
        },
      },
      vault: {
        totalAssets: toNumber(vault.totalAssets),
        availableLiquidity: toNumber(vault.availableLiquidity),
        protocolReserve: toNumber(vault.protocolReserve),
        firstLossTranche: toNumber(vault.firstLossTranche),
        queueTotal: toNumber(vault.queueTotal),
        realizedLosses: toNumber(vault.realizedLosses),
        activeBorrowers: vault.activeBorrowers,
        onWatch: vault.onWatch,
        routedRevenue30d: toNumber(vault.routedRevenue30d),
        principalRepaid: toNumber(vault.principalRepaid),
        interestGenerated: toNumber(vault.interestGenerated),
        sharePrice: toNumber(vault.sharePrice),
      },
      lp: {
        address: lp.address,
        walletBalance: toNumber(lp.walletBalance),
        supplied: toNumber(lp.supplied),
        shares: toNumber(lp.shares),
        queued: toNumber(lp.queued),
        queueFunded: toNumber(lp.queueFunded),
      },
      events,
      alerts,
      meta: {
        day: vault.day,
        network: NETWORK_NAME,
        asOf: new Date().toISOString(),
      },
    };
  }
}
