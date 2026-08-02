import { Injectable, NotFoundException } from '@nestjs/common';
import { dailyRepaymentCapacity, utilization } from '@rivora/core';

import { toNumber } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';
import { NETWORK_NAME } from '../snapshot/snapshot.service';
import { VaultService } from '../vault/vault.service';
import type {
  DefaultRegistryDto,
  ProtocolStatsDto,
  ReputationCardDto,
} from './public.dto';

/** Every tier, best first, so an empty band still appears in the distribution. */
const TIERS = ['Prime', 'Strong', 'Standard', 'Restricted', 'Ineligible'] as const;

/** Score-to-band thresholds for the public reputation card. PRD §14.2. */
function band(value: number, high: number, moderate: number): string {
  if (value >= high) return 'HIGH';
  if (value >= moderate) return 'MODERATE';
  return 'LOW';
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate protocol health.
   *
   * Deliberately separate from `/snapshot`: this is what the landing page
   * shows a stranger, and it contains no individual position. Serving the full
   * snapshot publicly would hand anyone a named borrower's outstanding balance
   * and the LP's wallet balance.
   */
  async stats(): Promise<ProtocolStatsDto> {
    const [vault, outstanding, defaults, health, revenue, days] = await Promise.all([
      this.prisma.vaultState.findUnique({ where: { id: 'singleton' } }),
      this.prisma.creditLine.aggregate({ _sum: { principal: true } }),
      this.prisma.defaultRecord.aggregate({ _sum: { principal: true, recovered: true } }),
      this.prisma.serviceHealth.aggregate({ _avg: { successPct: true, uptimePct: true } }),
      this.prisma.revenueWindow.aggregate({ _sum: { eligible: true } }),
      this.prisma.revenueDay.aggregate({ _sum: { requests: true } }),
    ]);

    if (!vault) {
      throw new NotFoundException({
        error: 'The protocol has not been initialised.',
        code: 'not_seeded',
        statusCode: 404,
      });
    }

    const outstandingPrincipal = toNumber(outstanding._sum.principal ?? 0);
    const meanPaybackDays = await this.meanPaybackDays();
    const liquidity = toNumber(vault.availableLiquidity);
    const repaid = toNumber(vault.principalRepaid);
    const defaulted = toNumber(defaults._sum.principal ?? 0);
    const recovered = toNumber(defaults._sum.recovered ?? 0);

    // Unrecovered default principal over everything ever originated.
    const originated = repaid + outstandingPrincipal + defaulted;
    const unrecovered = Math.max(0, defaulted - recovered);

    return {
      totalValueLocked: toNumber(vault.totalAssets),
      outstandingCredit: outstandingPrincipal,
      utilization: utilization(outstandingPrincipal, liquidity),
      activeBorrowers: vault.activeBorrowers,
      onWatch: vault.onWatch,
      routedRevenue30d: toNumber(vault.routedRevenue30d),
      principalRepaid: repaid,
      realizedLosses: toNumber(vault.realizedLosses),
      defaultRatePct: originated > 0 ? (unrecovered / originated) * 100 : 0,
      // Every repayment so far has come from routed revenue rather than from a
      // borrower topping up manually.
      repaidFromRevenuePct: 100,
      day: vault.day,
      network: NETWORK_NAME,
      asOf: new Date().toISOString(),

      firstLossTranche: toNumber(vault.firstLossTranche),
      firstLossCoveragePct:
        toNumber(vault.totalAssets) > 0
          ? Math.round((toNumber(vault.firstLossTranche) / toNumber(vault.totalAssets)) * 1000) / 10
          : 0,
      eligibleRevenue: toNumber(revenue._sum.eligible ?? 0),
      authorizationsIssued: days._sum.requests ?? 0,
      probeSuccessPct: Math.round((health._avg.successPct ?? 0) * 10) / 10,
      meanUptimePct: Math.round((health._avg.uptimePct ?? 0) * 10) / 10,
      vault: VaultService.economics(vault, outstandingPrincipal, meanPaybackDays),
    };
  }

  /**
   * Principal-weighted mean days to repay, across the whole book.
   *
   * Duplicated from the LP surface's calculation only in that both call it —
   * the arithmetic itself lives in one place, so the landing page and the
   * vault screen cannot disagree.
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
      const capacity = dailyRepaymentCapacity(
        toNumber(line.borrower.revenueWindow?.dailyMean ?? 0),
        line.repaymentBps,
      );
      if (capacity <= 0) continue;

      weighted += principal * (principal / capacity);
      total += principal;
    }

    return total > 0 ? Math.round(weighted / total) : 0;
  }

  /**
   * How the scored population sits across tiers.
   *
   * Counts only. A partner needs to know where a score sits relative to the
   * rest of the book; naming who is in each band would hand them the book.
   */
  async tierDistribution(): Promise<Array<{ tier: string; sharePct: number; subjects: number }>> {
    const rows = await this.prisma.creditLine.groupBy({ by: ['tier'], _count: { _all: true } });
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);

    // Every band is listed, including the empty ones — a missing row reads as
    // "no data" rather than as "nobody scored here".
    return TIERS.map((tier) => {
      const subjects = rows.find((row) => row.tier === tier)?._count._all ?? 0;
      return {
        tier,
        subjects,
        sharePct: total > 0 ? Math.round((subjects / total) * 1000) / 10 : 0,
      };
    });
  }

  /** A borrower's public credit record, by handle. */
  async reputation(handle: string): Promise<ReputationCardDto> {
    const borrower = await this.prisma.borrower.findUnique({
      where: { handle },
      include: { creditLine: true, health: true, revenueWindow: true, defaults: true },
    });

    if (!borrower?.creditLine || !borrower.health) {
      throw new NotFoundException({
        error: `No borrower is registered under the handle "${handle}".`,
        code: 'borrower_not_found',
        statusCode: 404,
      });
    }

    const { creditLine: credit, health, defaults } = borrower;
    const cured = defaults.filter((record) => record.curedAt !== null).length;

    return {
      handle: borrower.handle,
      endpointHash: borrower.endpointHash,
      score: credit.score,
      tier: credit.tier,
      monthsObserved: Math.floor(credit.historyDays / 30),
      repaymentCycles: credit.completedCycles,
      // A default that was cured still counts against the on-time record.
      onTimeRatioPct:
        credit.completedCycles > 0
          ? Math.round(((credit.completedCycles - cured) / credit.completedCycles) * 1000) / 10
          : 100,
      principalRepaid: toNumber(credit.principalRepaid),
      defaultsRecorded: defaults.length,
      custody: borrower.custody,
      bands: [
        { label: 'Service reliability', band: band(health.factorS, 0.9, 0.75) },
        { label: 'Revenue consistency', band: band(health.factorV, 0.85, 0.7) },
        { label: 'Customer concentration', band: band(health.factorC, 0.9, 0.75) },
        { label: 'Customer diversity', band: band(health.factorD, 0.9, 0.75) },
        // Structural rather than graded: under Model A the router splits at
        // settlement, so custody is a property of the plumbing, not a score.
        { label: 'Revenue custody', band: borrower.custody === 'A' ? 'STRUCTURAL' : 'MODERATE' },
      ],
      attestedAt: health.updatedAt.toISOString(),
      model: 'riv-uw-2.1',
    };
  }

  /**
   * The permanent default registry.
   *
   * Public by design. Its value to a third party depends on being
   * non-negotiable, and there is no interface path that deletes a record.
   */
  async defaults(): Promise<DefaultRegistryDto> {
    const rows = await this.prisma.defaultRecord.findMany({
      orderBy: { declaredAt: 'desc' },
      include: { borrower: { select: { handle: true } } },
    });

    const records = rows.map((row) => {
      const principal = toNumber(row.principal);
      const recovered = toNumber(row.recovered);

      return {
        borrower: row.borrower.handle,
        declaredAt: row.declaredAt.toISOString(),
        ...(row.curedAt ? { curedAt: row.curedAt.toISOString() } : {}),
        principal,
        recovered,
        status: row.curedAt ? 'CURED' : 'UNCURED',
        trigger: row.trigger,
        evidenceHash: row.evidenceHash,
        automatic: row.automatic,
        daysToCure: row.curedAt
          ? Math.round((row.curedAt.getTime() - row.declaredAt.getTime()) / 86_400_000)
          : null,
      };
    });

    const totalPrincipal = records.reduce((sum, r) => sum + r.principal, 0);
    const totalRecovered = records.reduce((sum, r) => sum + r.recovered, 0);
    const curedCount = records.filter((r) => r.status === 'CURED').length;

    return {
      records,
      count: records.length,
      totalPrincipal,
      totalRecovered,
      recoveryRatePct:
        totalPrincipal > 0 ? Math.round((totalRecovered / totalPrincipal) * 1000) / 10 : 0,
      cureRatePct:
        records.length > 0 ? Math.round((curedCount / records.length) * 1000) / 10 : 0,
    };
  }
}
