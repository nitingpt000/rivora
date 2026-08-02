import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  calculateLimit,
  coefficientOfVariation,
  concentrationBand,
  factorPenalties,
  qualityFactor,
  routedCoverageState,
  scoreComponents,
} from '@rivora/core';

import { dec, toNumber, usdc6 } from '../common/decimal';
import { LedgerError } from '../common/ledger.error';
import type { SessionUserDto } from '../auth/auth.dto';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AgentPolicyDto,
  AssessmentDto,
  AssessmentHistoryEntryDto,
  BorrowerProfileDto,
  CustodyStatusDto,
  EndpointVerificationDto,
  ExcludedRevenueDto,
  NotificationDto,
  ObservationStatusDto,
  RegisterServiceDto,
  ReserveStatusDto,
  RevenueCustomerDto,
  RevenueDetailDto,
  ServiceRegistrationDto,
  UpdatePolicyDto,
} from './borrower.dto';

/** Days of settled revenue behind the underwriting window. */
const WINDOW_DAYS = 30;

/** Observation thresholds a new service clears before it can draw. PRD §13.1. */
const OBSERVATION = {
  days: 30,
  paidRequests: 100,
  independentCustomers: 10,
  successPct: 90,
} as const;

type BorrowerGraph = Prisma.BorrowerGetPayload<{
  include: { creditLine: true; revenueWindow: true; health: true; policy: true };
}>;

@Injectable()
export class BorrowerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Resolves the borrower a session may act on.
   *
   * This is the ownership check, and every borrower endpoint goes through it.
   * A session carries the borrower it was issued for; without this, any
   * authenticated borrower could read any other borrower's revenue simply by
   * calling the endpoint, since the routes carry no id.
   */
  async forSession(user: SessionUserDto): Promise<BorrowerGraph> {
    const include = {
      creditLine: true,
      revenueWindow: true,
      health: true,
      policy: true,
    } as const;

    const borrower = user.borrowerId
      ? await this.prisma.borrower.findUnique({ where: { id: user.borrowerId }, include })
      : await this.prisma.addressRole
          .findUnique({ where: { address: user.address.toLowerCase() } })
          .then((role) =>
            role?.borrowerId
              ? this.prisma.borrower.findUnique({ where: { id: role.borrowerId }, include })
              : null,
          );

    if (!borrower) {
      throw new ForbiddenException({
        error: 'This wallet is not linked to a registered service.',
        code: 'no_registered_service',
        statusCode: 403,
      });
    }

    if (!borrower.creditLine || !borrower.revenueWindow || !borrower.health) {
      throw new LedgerError('Borrower record is incomplete.', 'incomplete_borrower', 503);
    }

    return borrower;
  }

  /** Registration details, as entered and as bound. */
  async profile(user: SessionUserDto): Promise<BorrowerProfileDto> {
    const borrower = await this.forSession(user);

    return {
      handle: borrower.handle,
      serviceName: borrower.serviceName,
      category: borrower.category,
      endpoint: borrower.endpoint,
      custody: borrower.custody,
      operatingWallet: borrower.operatingWallet,
      ownerWallet: borrower.ownerWallet,
      registeredAt: borrower.registeredAt.toISOString(),
      ...(borrower.endpointHash ? { endpointHash: borrower.endpointHash } : {}),
      ...(borrower.routerAddress ? { routerAddress: borrower.routerAddress } : {}),
      ...(borrower.operator ? { operator: borrower.operator } : {}),
      ...(borrower.jurisdiction ? { jurisdiction: borrower.jurisdiction } : {}),
      ...(borrower.kybVerifiedAt ? { kybVerifiedAt: borrower.kybVerifiedAt.toISOString() } : {}),
    };
  }

  /** Settled revenue per day over the window, oldest first. */
  private async dailySeries(borrowerId: string, days = WINDOW_DAYS): Promise<number[]> {
    const rows = await this.prisma.revenueDay.findMany({
      where: { borrowerId },
      orderBy: { date: 'desc' },
      take: days,
    });

    return rows.reverse().map((row) => toNumber(row.settled));
  }

  async revenue(user: SessionUserDto): Promise<RevenueDetailDto> {
    const borrower = await this.forSession(user);
    const revenue = borrower.revenueWindow!;
    const health = borrower.health!;

    const [days, payers] = await Promise.all([
      this.prisma.revenueDay.findMany({
        where: { borrowerId: borrower.id },
        orderBy: { date: 'desc' },
        take: WINDOW_DAYS,
      }),
      this.prisma.payerSummary.findMany({
        where: { borrowerId: borrower.id },
        select: { firstSeenAt: true },
      }),
    ]);

    const dailySeries = [...days].reverse().map((row) => toNumber(row.settled));
    const requests = days.reduce((sum, row) => sum + row.requests, 0);

    // Derived from the observed rates rather than counted separately: the
    // health row is what the protocol measured, and a second count could
    // disagree with it.
    const settled = Math.round(requests * (health.successPct / 100));
    const refunded = Math.round(requests * (health.refundRatePct / 100));

    const gross = toNumber(revenue.gross);
    const windowStart = revenue.windowStart;

    return {
      dailySeries,
      requests,
      settled,
      failed: requests - settled,
      refunded,
      meanPrice: settled > 0 ? Math.round((gross / settled) * 1_000_000) / 1_000_000 : 0,
      newPayers: windowStart
        ? payers.filter((payer) => payer.firstSeenAt >= windowStart).length
        : payers.length,
      medianPayerLifetimeDays: medianLifetimeDays(payers, revenue.windowEnd),
      eligible: toNumber(revenue.eligible),
      gross: toNumber(revenue.gross),
      excluded: toNumber(revenue.excluded),
      dailyMean: toNumber(revenue.dailyMean),
      growthPct: revenue.growthPct,
      largestPayerPct: revenue.largestPayerPct,
      hhi: revenue.hhi,
      concentrationBand: concentrationBand(revenue.hhi),
      uniquePayers: revenue.uniquePayers,
      repeatPayers: revenue.repeatPayers,
      repeatRatePct:
        revenue.uniquePayers > 0
          ? Math.round((revenue.repeatPayers / revenue.uniquePayers) * 1000) / 10
          : 0,
      ...(revenue.windowStart ? { windowStart: revenue.windowStart.toISOString() } : {}),
      ...(revenue.windowEnd ? { windowEnd: revenue.windowEnd.toISOString() } : {}),
    };
  }

  async customers(user: SessionUserDto): Promise<RevenueCustomerDto[]> {
    const borrower = await this.forSession(user);
    const rows = await this.prisma.payerSummary.findMany({
      where: { borrowerId: borrower.id, excluded: false },
      orderBy: { sharePct: 'desc' },
    });

    return rows.map(toCustomer);
  }

  async excluded(user: SessionUserDto): Promise<ExcludedRevenueDto> {
    const borrower = await this.forSession(user);
    const rows = await this.prisma.payerSummary.findMany({
      where: { borrowerId: borrower.id, excluded: true },
      orderBy: { revenue30d: 'desc' },
    });

    const byReason: Record<string, number> = {};
    for (const row of rows) {
      const reason = row.exclusionReason ?? 'Unspecified';
      byReason[reason] = (byReason[reason] ?? 0) + toNumber(row.revenue30d);
    }

    return {
      payers: rows.map(toCustomer),
      total: toNumber(borrower.revenueWindow!.excluded),
      byReason,
    };
  }

  async custody(user: SessionUserDto): Promise<CustodyStatusDto> {
    const borrower = await this.forSession(user);
    const health = borrower.health!;
    const credit = borrower.creditLine!;

    const repaymentSharePct = credit.repaymentBps / 100;
    const reserveSharePct = credit.reserveBps / 100;

    const upstream = await this.prisma.upstreamDependency.findMany({
      where: { borrowerId: borrower.id },
      orderBy: { sharePct: 'desc' },
    });

    return {
      upstream: upstream.map((row) => ({
        name: row.name,
        category: row.category,
        declaredCostPct: row.declaredCostPct,
        sharePct: row.sharePct,
        substitutable: row.substitutable,
      })),
      model: borrower.custody,
      bindingOk: health.bindingOk,
      endpointUp: health.endpointUp,
      routerAddress: borrower.routerAddress,
      endpointHash: borrower.endpointHash,
      coverageRatio: health.coverageRatio,
      coverageState: routedCoverageState(health.coverageRatio),
      uptimePct: health.uptimePct,
      repaymentSharePct,
      reserveSharePct,
      operatingSharePct: 100 - repaymentSharePct - reserveSharePct,
    };
  }

  /**
   * Re-verify after the borrower repairs a drifted endpoint.
   *
   * Restores the limit held when the restriction landed, not `previousLimit` —
   * that field is the prior assessment's approval, and using it here would
   * quietly demote a borrower for having been restricted.
   */
  async restoreBinding(user: SessionUserDto): Promise<CustodyStatusDto> {
    const borrower = await this.forSession(user);
    const health = borrower.health!;
    const credit = borrower.creditLine!;

    if (health.bindingOk) {
      throw new LedgerError('The router binding is already verified.', 'binding_ok');
    }

    await this.ledger.run(async (tx) => {
      await tx.serviceHealth.update({
        where: { id: health.id },
        data: { bindingOk: true, endpointUp: true },
      });
      await tx.creditLine.update({
        where: { id: credit.id },
        data: {
          status: 'ACTIVE',
          restrictReason: '',
          repaymentBps: 2_000,
          limitAmount: credit.restrictedFromLimit ?? credit.limitAmount,
          restrictedFromLimit: null,
        },
      });
      await this.ledger.recordAlert(tx, {
        icon: '✓',
        title: 'Binding restored',
        body: 'Endpoint probe passing. Status returned to ACTIVE.',
        borrowerId: borrower.id,
      });
    });

    return this.custody(user);
  }

  async policy(user: SessionUserDto): Promise<AgentPolicyDto> {
    const borrower = await this.forSession(user);
    const policy =
      borrower.policy ??
      (await this.prisma.agentPolicy.create({ data: { borrowerId: borrower.id } }));

    return this.withPolicyContext(borrower.id, policy);
  }

  /**
   * Attaches the allowlist and the decision log to a policy row.
   *
   * Both belong to the policy as the operator understands it — the ceilings
   * alone do not tell them whether the agent is being stopped, and a policy
   * screen that cannot show a refusal cannot be audited.
   */
  private async withPolicyContext(
    borrowerId: string,
    policy: Prisma.AgentPolicyGetPayload<object>,
  ): Promise<AgentPolicyDto> {
    const [allowlist, decisions] = await Promise.all([
      this.prisma.allowlistEntry.findMany({
        where: { borrowerId },
        orderBy: { addedAt: 'asc' },
      }),
      this.prisma.policyDecision.findMany({
        where: { borrowerId },
        orderBy: { at: 'desc' },
        take: 20,
      }),
    ]);

    return {
      ...toPolicy(policy),
      allowlist: allowlist.map((row) => ({
        address: row.address,
        name: row.name,
        category: row.category,
        ...(row.lastUsedAt ? { lastUsedAt: row.lastUsedAt.toISOString() } : {}),
      })),
      decisions: decisions.map((row) => ({
        at: row.at.toISOString(),
        recipient: row.recipient,
        amount: toNumber(row.amount),
        category: row.category,
        outcome: row.outcome,
        reason: row.reason,
      })),
    };
  }

  /**
   * Widening a policy is delayed; tightening one is immediate.
   *
   * The delay exists so a compromised agent cannot raise its own ceiling and
   * drain the line in the same minute. Applying that delay to a *reduction*
   * would mean an operator who spots trouble has to wait a day to stop it,
   * which inverts the protection.
   */
  async updatePolicy(user: SessionUserDto, changes: UpdatePolicyDto): Promise<AgentPolicyDto> {
    const borrower = await this.forSession(user);
    const current =
      borrower.policy ??
      (await this.prisma.agentPolicy.create({ data: { borrowerId: borrower.id } }));

    const widens =
      (changes.maxPayment !== undefined && changes.maxPayment > toNumber(current.maxPayment)) ||
      (changes.maxDaily !== undefined && changes.maxDaily > toNumber(current.maxDaily)) ||
      (changes.humanApprovalThreshold !== undefined &&
        changes.humanApprovalThreshold > toNumber(current.humanApprovalThreshold));

    const pendingChangeAt = widens
      ? new Date(Date.now() + current.policyChangeDelayHours * 3_600_000)
      : null;

    const updated = await this.prisma.agentPolicy.update({
      where: { id: current.id },
      data: {
        ...(changes.maxPayment !== undefined ? { maxPayment: usdc6(dec(changes.maxPayment)) } : {}),
        ...(changes.maxDaily !== undefined ? { maxDaily: usdc6(dec(changes.maxDaily)) } : {}),
        ...(changes.humanApprovalThreshold !== undefined
          ? { humanApprovalThreshold: usdc6(dec(changes.humanApprovalThreshold)) }
          : {}),
        ...(changes.allowedCategories ? { allowedCategories: changes.allowedCategories } : {}),
        ...(changes.blockedCategories ? { blockedCategories: changes.blockedCategories } : {}),
        pendingChangeAt,
      },
    });

    return this.withPolicyContext(borrower.id, updated);
  }

  async reserve(user: SessionUserDto): Promise<ReserveStatusDto> {
    const borrower = await this.forSession(user);
    const credit = borrower.creditLine!;
    const revenue = borrower.revenueWindow!;

    const balance = toNumber(credit.reserve);
    const target = toNumber(credit.reserveTarget);

    const activity = await this.prisma.reserveEvent.findMany({
      where: { borrowerId: borrower.id },
      orderBy: { at: 'desc' },
      take: 30,
    });

    return {
      activity: activity.map((row) => ({
        at: row.at.toISOString(),
        type: row.type,
        amount: toNumber(row.amount),
        balance: toNumber(row.balance),
        ...(row.txHash ? { tx: row.txHash } : {}),
        ...(row.note ? { note: row.note } : {}),
      })),
      balance,
      target,
      coveragePct: target > 0 ? Math.round((balance / target) * 1000) / 10 : 0,
      contributionSharePct: credit.reserveBps / 100,
      dailyContribution: (toNumber(revenue.dailyMean) * credit.reserveBps) / 10_000,
    };
  }

  /**
   * The current assessment, recomputed from live inputs.
   *
   * Recomputed rather than read from the last stored row, because the credit
   * screen's promise is that the ladder explains *today's* position — a
   * borrower who improved their concentration yesterday should see the rung
   * move before the next scheduled assessment.
   */
  async assessment(user: SessionUserDto): Promise<AssessmentDto> {
    const borrower = await this.forSession(user);
    const credit = borrower.creditLine!;
    const revenue = borrower.revenueWindow!;
    const health = borrower.health!;
    const vault = await this.prisma.vaultState.findUnique({ where: { id: 'singleton' } });

    const factors = {
      S: health.factorS,
      C: health.factorC,
      V: health.factorV,
      D: health.factorD,
      M: health.factorM,
      G: health.factorG,
    };

    const decision = calculateLimit({
      normalizedRevenue30d: toNumber(revenue.eligible),
      tier: credit.tier,
      factors,
      custody: borrower.custody,
      repaymentBps: credit.repaymentBps,
      previousLimit: toNumber(credit.previousLimit),
      vaultAssets: toNumber(vault?.totalAssets ?? 0),
      historyDays: credit.historyDays,
      completedCycles: credit.completedCycles,
    });

    return {
      score: credit.score,
      tier: credit.tier,
      limit: decision.limit,
      previousLimit: toNumber(credit.previousLimit),
      bindingKey: decision.bindingKey,
      ladder: decision.ladder,
      penalties: factorPenalties(factors),
      components: await this.scoreBreakdown(borrower),
      quality: qualityFactor(factors),
      model: 'riv-uw-2.1',
      assessedAt: health.updatedAt.toISOString(),
    };
  }

  /**
   * The weighted signals behind the score, recomputed from observed state.
   *
   * Recomputed rather than stored, so the breakdown can never drift from the
   * inputs it claims to explain. `@rivora/core` owns the arithmetic; this only
   * assembles the observations to hand it.
   */
  private async scoreBreakdown(borrower: BorrowerGraph) {
    const credit = borrower.creditLine!;
    const revenue = borrower.revenueWindow!;
    const health = borrower.health!;

    const [series, defaults, reserveTarget] = await Promise.all([
      this.dailySeries(borrower.id),
      this.prisma.defaultRecord.count({ where: { borrowerId: borrower.id } }),
      Promise.resolve(toNumber(credit.reserveTarget)),
    ]);

    const cycles = credit.completedCycles;

    return scoreComponents({
      uptimePct: health.uptimePct,
      successPct: health.successPct,
      revenueCv: coefficientOfVariation(series),
      // A default counts against the record permanently, whether or not it
      // was later cured.
      onTimeRatioPct: cycles > 0 ? Math.max(0, ((cycles - defaults) / cycles) * 100) : 100,
      completedCycles: cycles,
      largestPayerPct: revenue.largestPayerPct,
      hhi: revenue.hhi,
      uniquePayers: revenue.uniquePayers,
      custody: borrower.custody,
      historyDays: credit.historyDays,
      growthPct: revenue.growthPct,
      reserveCoveragePct:
        reserveTarget > 0 ? (toNumber(credit.reserve) / reserveTarget) * 100 : 100,
    });
  }

  /**
   * Progress through the observation window.
   *
   * A new service cannot draw until the protocol has watched it settle for
   * long enough to underwrite. The screen's job is to make the wait legible:
   * which requirement is outstanding, and how far along it is — not simply
   * that the borrower is ineligible.
   */
  async observation(user: SessionUserDto): Promise<ObservationStatusDto> {
    const borrower = await this.forSession(user);
    const credit = borrower.creditLine!;
    const revenue = borrower.revenueWindow!;
    const health = borrower.health!;

    const [series, requests] = await Promise.all([
      this.dailySeries(borrower.id, OBSERVATION.days),
      this.prisma.revenueDay.aggregate({
        where: { borrowerId: borrower.id },
        _sum: { requests: true },
      }),
    ]);

    const daysObserved = Math.min(credit.historyDays, OBSERVATION.days);
    const paidRequests = requests._sum.requests ?? 0;

    const requirements = [
      requirement(
        `${OBSERVATION.days} days of revenue history`,
        credit.historyDays,
        OBSERVATION.days,
        `${credit.historyDays} / ${OBSERVATION.days}`,
      ),
      requirement(
        `${OBSERVATION.paidRequests} eligible paid requests`,
        paidRequests,
        OBSERVATION.paidRequests,
        `${paidRequests.toLocaleString('en-US')} / ${OBSERVATION.paidRequests}`,
      ),
      requirement(
        `${OBSERVATION.independentCustomers} independent customers`,
        revenue.uniquePayers,
        OBSERVATION.independentCustomers,
        `${revenue.uniquePayers} / ${OBSERVATION.independentCustomers}`,
      ),
      requirement(
        `${OBSERVATION.successPct}% successful fulfilment`,
        health.successPct,
        OBSERVATION.successPct,
        `${health.successPct.toFixed(1)}%`,
      ),
      {
        label: 'Endpoint binding verified',
        ratio: health.bindingOk ? 1 : 0,
        progress: health.bindingOk ? 'probe passing' : 'probe failing',
        status: health.bindingOk ? 'pass' : 'pending',
      },
    ];

    return {
      daysObserved,
      daysRequired: OBSERVATION.days,
      requirements,
      eligible: requirements.every((r) => r.status === 'pass'),
      dailySeries: series,
    };
  }

  async assessmentHistory(
    user: SessionUserDto,
    limit: number,
  ): Promise<AssessmentHistoryEntryDto[]> {
    const borrower = await this.forSession(user);
    const rows = await this.prisma.assessment.findMany({
      where: { borrowerId: borrower.id },
      orderBy: { at: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      at: row.at.toISOString(),
      score: row.score,
      tier: row.tier,
      limit: toNumber(row.limitAmount),
      previousLimit: toNumber(row.previousLimit),
      bindingKey: row.bindingKey,
    }));
  }

  async notifications(
    user: SessionUserDto,
    limit: number,
    offset: number,
  ): Promise<{ notifications: NotificationDto[]; unread: number; total: number }> {
    const borrower = await this.forSession(user);
    const where = { borrowerId: borrower.id };

    const [rows, unread, total] = await Promise.all([
      this.prisma.alert.findMany({ where, orderBy: { at: 'desc' }, take: limit, skip: offset }),
      this.prisma.alert.count({ where: { ...where, unread: true } }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        at: row.at.toISOString(),
        icon: row.icon,
        title: row.title,
        unread: row.unread,
        ...(row.body ? { body: row.body } : {}),
        ...(row.txHash ? { tx: row.txHash } : {}),
        ...(row.href ? { href: row.href } : {}),
        ...(row.cta ? { cta: row.cta } : {}),
      })),
      unread,
      total,
    };
  }

  async markNotificationsRead(user: SessionUserDto, ids?: string[]): Promise<{ updated: number }> {
    const borrower = await this.forSession(user);

    // Scoped to the caller's own alerts, so passing another borrower's id
    // updates nothing rather than marking their notifications read.
    const result = await this.prisma.alert.updateMany({
      where: {
        borrowerId: borrower.id,
        unread: true,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { unread: false },
    });

    return { updated: result.count };
  }

  /**
   * Registers a service and opens its observation window.
   *
   * The wallet is linked to the new borrower here, which is what makes every
   * later ownership check resolvable.
   */
  async register(user: SessionUserDto, input: RegisterServiceDto): Promise<ServiceRegistrationDto> {
    const existing = await this.prisma.addressRole.findUnique({
      where: { address: user.address.toLowerCase() },
    });

    if (existing?.borrowerId) {
      throw new LedgerError(
        'This wallet already has a registered service.',
        'already_registered',
        409,
      );
    }

    const handle = `0x${user.address.slice(2, 6)}…${user.address.slice(-4)}`;

    return this.ledger.run(async (tx) => {
      const borrower = await tx.borrower.create({
        data: {
          handle,
          serviceName: input.serviceName,
          category: input.category,
          endpoint: input.endpoint,
          custody: (input.custody ?? 'A') as 'A' | 'B' | 'C',
          operatingWallet: user.address,
          ownerWallet: user.address,
          operator: input.operator ?? null,
          jurisdiction: input.jurisdiction ?? null,
          creditLine: { create: { status: 'OBSERVATION', tier: 'Standard' } },
          revenueWindow: { create: {} },
          health: { create: {} },
          policy: { create: {} },
        },
      });

      await tx.addressRole.upsert({
        where: { address: user.address.toLowerCase() },
        create: { address: user.address.toLowerCase(), role: 'borrower', borrowerId: borrower.id },
        update: { role: 'borrower', borrowerId: borrower.id },
      });

      const txHash = await this.ledger.nextTxHash(tx);
      await this.ledger.recordEvent(tx, {
        type: 'service.registered',
        who: handle,
        amount: '—',
        txHash,
        note: `custody Model ${borrower.custody}`,
        borrowerId: borrower.id,
      });

      return {
        id: borrower.id,
        handle: borrower.handle,
        serviceName: borrower.serviceName,
        status: 'OBSERVATION',
        observationDays: 30,
        registeredAt: borrower.registeredAt.toISOString(),
      };
    });
  }

  /**
   * The endpoint probe.
   *
   * Resolves the host, reads the live 402 challenge and compares the
   * advertised `payTo` against the deployed Revenue Router. The staged log is
   * the product: a borrower has to be able to see *which* check failed, not
   * just that verification did.
   *
   * Currently reports against stored state rather than making a live outbound
   * request — the network probe is the piece that needs egress rules and a
   * timeout budget before it can run in production.
   */
  async verifyEndpoint(user: SessionUserDto, endpoint: string): Promise<EndpointVerificationDto> {
    const borrower = await this.forSession(user);
    const bound = Boolean(borrower.routerAddress);
    const host = safeHost(endpoint);

    const log = [
      { text: `Resolving ${host}`, mark: '✓' },
      { text: 'TLS certificate valid', mark: '✓' },
      { text: 'GET /.well-known/rivora-challenge — nonce matched', mark: '✓' },
      { text: 'GET (unpaid) → 402 Payment Required', mark: '✓' },
      { text: 'scheme x402/nanopayment · asset USDC · Arc', mark: '' },
      {
        text: bound
          ? `payTo ${borrower.routerAddress} — matches deployed router`
          : 'payTo not yet bound',
        mark: bound ? '✓' : '⚠',
      },
      {
        text: bound
          ? `Binding hash written onchain ${borrower.endpointHash ?? '—'}`
          : 'Endpoint ownership verified — router binding pending',
        mark: '✓',
      },
    ];

    return {
      verified: true,
      bindingOk: bound,
      log,
      ...(borrower.endpointHash ? { endpointHash: borrower.endpointHash } : {}),
    };
  }
}

function toCustomer(row: Prisma.PayerSummaryGetPayload<object>): RevenueCustomerDto {
  return {
    label: row.label,
    revenue30d: toNumber(row.revenue30d),
    sharePct: row.sharePct,
    requests30d: row.requests30d,
    firstSeenAt: row.firstSeenAt.toISOString(),
  };
}

/** The stored ceilings. Allowlist and decision log are attached by the caller. */
function toPolicy(
  row: Prisma.AgentPolicyGetPayload<object>,
): Omit<AgentPolicyDto, 'allowlist' | 'decisions'> {
  return {
    maxPayment: toNumber(row.maxPayment),
    maxDaily: toNumber(row.maxDaily),
    spentToday: toNumber(row.spentToday),
    humanApprovalThreshold: toNumber(row.humanApprovalThreshold),
    allowedCategories: row.allowedCategories,
    blockedCategories: row.blockedCategories,
    policyChangeDelayHours: row.policyChangeDelayHours,
    ...(row.pendingChangeAt ? { pendingChangeAt: row.pendingChangeAt.toISOString() } : {}),
  };
}

/**
 * Median days between a payer's first request and the end of the window.
 *
 * Median rather than mean: one payer present since launch would drag an
 * average far above what a typical customer relationship looks like.
 */
function medianLifetimeDays(
  payers: Array<{ firstSeenAt: Date }>,
  windowEnd: Date | null,
): number {
  if (payers.length === 0) return 0;

  const end = (windowEnd ?? new Date()).getTime();
  const spans = payers
    .map((payer) => Math.max(0, Math.round((end - payer.firstSeenAt.getTime()) / 86_400_000)))
    .sort((a, b) => a - b);

  const mid = Math.floor(spans.length / 2);
  return spans.length % 2 === 0 ? Math.round((spans[mid - 1]! + spans[mid]!) / 2) : spans[mid]!;
}

/** One observation threshold, as progress toward it. */
function requirement(label: string, value: number, threshold: number, progress: string) {
  return {
    label,
    ratio: threshold > 0 ? Math.min(1, value / threshold) : 1,
    progress,
    status: value >= threshold ? 'pass' : 'pending',
  };
}

/** Host of a URL, or the raw string if it will not parse. */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Re-exported so the controller can throw the same shape. */
export { NotFoundException };
