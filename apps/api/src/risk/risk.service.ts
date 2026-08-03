import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  borrowerRate,
  calculateLimit,
  coefficientOfVariation,
  scoreComponents,
  UNDERWRITING,
  utilization,
  VAULT,
} from '@rivora/core';

import { AssessmentService } from '../assessment/assessment.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUserDto } from '../auth/auth.dto';
import { dec, toNumber, usdc6 } from '../common/decimal';
import { LedgerError } from '../common/ledger.error';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AnomalyDetailDto,
  DeclarationStatusDto,
  BorrowerRiskDetailDto,
  LimitRecommendationDto,
  DeclareDefaultDto,
  ExposureReportDto,
  RiskAlertDto,
  RiskParameterDto,
  WatchlistEntryDto,
} from './risk.dto';

/** Sector share above which new draws in that sector are blocked. */
const SECTOR_CAP_PCT = 40;

/**
 * Distinct operator signatures required to commit a default. PRD §19.8 / §33.
 *
 * Two rather than the PRD's 2-of-3 because two operators are seeded; the
 * threshold is what matters, and it is a constant precisely so raising it is
 * a one-line change reviewed on its own.
 */
const DEFAULT_QUORUM = 2;

/**
 * Read from `@rivora/core` rather than restated, so the number an operator is
 * shown is the number the underwriter actually applies.
 */
const PER_BORROWER_CAP_PCT = UNDERWRITING.exposureCapPct * 100;
const BUFFER_FLOOR_PCT = VAULT.bufferFloorPct * 100;

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly assessments: AssessmentService,
  ) {}

  /**
   * Borrowers needing attention.
   *
   * Anything not cleanly ACTIVE, plus anything ACTIVE whose routed coverage
   * has drifted — coverage falling is the earliest signal that revenue is
   * finding a way around the router, and waiting for a status change would
   * mean acting after the fact.
   */
  async watchlist(): Promise<WatchlistEntryDto[]> {
    const rows = await this.prisma.borrower.findMany({
      include: { creditLine: true, health: true },
    });

    return rows
      .filter((row) => {
        if (!row.creditLine || !row.health) return false;
        const notClean = row.creditLine.status !== 'ACTIVE' && row.creditLine.status !== 'REPAID';
        return notClean || row.health.coverageRatio < 0.9;
      })
      .map((row) => {
        const credit = row.creditLine!;
        const health = row.health!;

        return {
          handle: row.handle,
          status: credit.status,
          score: credit.score,
          scoreDelta: credit.score - credit.previousScore,
          tier: credit.tier,
          principal: toNumber(credit.principal),
          coverageRatio: health.coverageRatio,
          trigger:
            credit.restrictReason ||
            credit.watchReason ||
            (health.coverageRatio < 0.9 ? `coverage ratio ${health.coverageRatio.toFixed(2)}` : '—'),
        };
      })
      .sort((a, b) => a.coverageRatio - b.coverageRatio);
  }

  async exposure(): Promise<ExposureReportDto> {
    const [vault, lines, borrowers, upstream] = await Promise.all([
      this.prisma.vaultState.findUnique({ where: { id: 'singleton' } }),
      this.prisma.creditLine.findMany({ select: { principal: true, tier: true } }),
      this.prisma.borrower.findMany({
        select: { category: true, creditLine: { select: { principal: true } } },
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

    if (!vault) {
      throw new NotFoundException({
        error: 'The protocol has not been initialised.',
        code: 'not_seeded',
        statusCode: 404,
      });
    }

    const assets = toNumber(vault.totalAssets);
    const principals = lines.map((line) => toNumber(line.principal));
    const outstanding = principals.reduce((sum, p) => sum + p, 0);
    const largest = principals.length ? Math.max(...principals) : 0;

    const buckets = new Map<string, { borrowers: number; principal: number }>();
    for (const line of lines) {
      const current = buckets.get(line.tier) ?? { borrowers: 0, principal: 0 };
      current.borrowers += 1;
      current.principal += toNumber(line.principal);
      buckets.set(line.tier, current);
    }

    const capAmount = (assets * PER_BORROWER_CAP_PCT) / 100;

    return {
      outstandingPrincipal: outstanding,
      vaultAssets: assets,
      utilization: utilization(outstanding, toNumber(vault.availableLiquidity)),
      byTier: [...buckets.entries()]
        .map(([tier, bucket]) => ({
          tier,
          borrowers: bucket.borrowers,
          principal: bucket.principal,
          sharePct:
            outstanding > 0 ? Math.round((bucket.principal / outstanding) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.principal - a.principal),
      bySector: groupPrincipal(
        borrowers.map((b) => ({
          key: b.category,
          principal: toNumber(b.creditLine?.principal ?? 0),
        })),
        outstanding,
      ).map((row) => ({
        sector: row.key,
        principal: row.principal,
        sharePct: row.sharePct,
        capPct: SECTOR_CAP_PCT,
        breached: row.sharePct > SECTOR_CAP_PCT,
      })),
      // Upstream concentration is measured across borrowers: two services that
      // both resell the same model provider are one dependency, not two. The
      // principal exposed through a provider is each borrower's principal
      // weighted by how much of their delivery depends on it.
      upstream: groupPrincipal(
        upstream.map((u) => ({
          key: u.name,
          principal: toNumber(u.borrower.creditLine?.principal ?? 0) * (u.sharePct / 100),
        })),
        outstanding,
      ).map((row) => ({
        name: row.key,
        category: upstream.find((u) => u.name === row.key)?.category ?? '—',
        principal: row.principal,
        sharePct: row.sharePct,
        // One borrower unable to substitute makes the whole dependency rigid.
        substitutable: upstream.filter((u) => u.name === row.key).every((u) => u.substitutable),
      })),
      largestExposure: largest,
      largestExposurePct: assets > 0 ? Math.round((largest / assets) * 1000) / 10 : 0,
      perBorrowerCapPct: PER_BORROWER_CAP_PCT,
      sectorCapPct: SECTOR_CAP_PCT,
      breaches: principals.filter((p) => p > capAmount).length,
    };
  }

  /**
   * The operator's alert feed.
   *
   * Derived from live state rather than stored, so an alert cannot outlive the
   * condition that raised it. An operator working a queue of alerts that were
   * true yesterday is worse off than one working none.
   */
  async alerts(): Promise<RiskAlertDto[]> {
    const [watchlist, exposure, anomalies] = await Promise.all([
      this.watchlist(),
      this.exposure(),
      this.prisma.anomaly.findMany({
        orderBy: { detectedAt: 'desc' },
        take: 10,
        include: { borrower: { select: { handle: true } } },
      }),
    ]);

    const alerts: RiskAlertDto[] = [];

    for (const anomaly of anomalies) {
      alerts.push({
        severity: 'restrict',
        who: anomaly.borrower.handle,
        text: `${anomaly.kind} detected — ${anomaly.payerCount} payers, ${toNumber(anomaly.washAmount).toFixed(2)} USDC`,
        // The instant travels as ISO-8601 in its own field. Embedding it in
        // prose leaves the reader with a raw timestamp the UI cannot format.
        at: anomaly.detectedAt.toISOString(),
        meta: 'auto-restricted',
        href: `/risk/anomaly?ref=${anomaly.reference}`,
        cta: 'Investigate',
      });
    }

    for (const entry of watchlist) {
      if (entry.coverageRatio >= 0.9) continue;
      alerts.push({
        severity: entry.status === 'RESTRICTED' ? 'restrict' : 'warn',
        who: entry.handle,
        text: `Coverage ratio ${entry.coverageRatio.toFixed(2)} — probable partial diversion`,
        meta: `${entry.status} · principal ${entry.principal.toFixed(2)}`,
        href: `/risk/borrower?handle=${encodeURIComponent(entry.handle)}`,
        cta: 'Review',
      });
    }

    for (const sector of exposure.bySector) {
      if (!sector.breached) continue;
      alerts.push({
        severity: 'warn',
        who: 'Sector',
        text: `${sector.sector} exposure ${sector.sharePct}%, cap ${sector.capPct}%`,
        meta: 'new draws in sector blocked',
        href: '/risk/exposure',
        cta: 'View exposure',
      });
    }

    return alerts;
  }

  /**
   * Where the ladder disagrees with the limit currently in force.
   *
   * Assessments run on a schedule, so a borrower's limit is always slightly
   * behind their inputs. This is the queue that gap creates — sorted by the
   * size of the disagreement, because that is what an operator should look at
   * first.
   */
  async recommendations(): Promise<LimitRecommendationDto[]> {
    const [borrowers, vault] = await Promise.all([
      this.prisma.borrower.findMany({
        include: { creditLine: true, revenueWindow: true, health: true },
      }),
      this.prisma.vaultState.findUnique({ where: { id: 'singleton' } }),
    ]);

    const vaultAssets = toNumber(vault?.totalAssets ?? 0);

    return borrowers
      .flatMap((borrower) => {
        const credit = borrower.creditLine;
        const revenue = borrower.revenueWindow;
        const health = borrower.health;
        if (!credit || !revenue || !health) return [];

        const decision = calculateLimit({
          normalizedRevenue30d: toNumber(revenue.eligible),
          tier: credit.tier,
          factors: {
            S: health.factorS,
            C: health.factorC,
            V: health.factorV,
            D: health.factorD,
            M: health.factorM,
            G: health.factorG,
          },
          custody: borrower.custody,
          repaymentBps: credit.repaymentBps,
          previousLimit: toNumber(credit.previousLimit),
          vaultAssets,
          historyDays: credit.historyDays,
          completedCycles: credit.completedCycles,
        });

        const current = toNumber(credit.limitAmount);
        const recommended = decision.limit;

        // A limit that already matches needs no decision, and listing it would
        // bury the ones that do.
        if (Math.abs(recommended - current) < 0.01) return [];

        return [
          {
            handle: borrower.handle,
            current,
            recommended,
            bindingKey: decision.bindingKey,
            tier: credit.tier,
            direction: recommended > current ? 'raise' : 'reduce',
          },
        ];
      })
      .sort((a, b) => Math.abs(b.recommended - b.current) - Math.abs(a.recommended - a.current));
  }

  /**
   * Forces an assessment for one borrower.
   *
   * Resolves the handle here so the operator names a borrower the way every
   * other risk route does, rather than having to know an internal id.
   */
  async reassess(handle: string): Promise<void> {
    const borrower = await this.prisma.borrower.findUnique({
      where: { handle },
      select: { id: true },
    });

    if (!borrower) {
      throw new NotFoundException({
        error: `No borrower is registered under the handle "${handle}".`,
        code: 'borrower_not_found',
        statusCode: 404,
      });
    }

    await this.assessments.reassess(borrower.id, 'operator request');
  }

  /**
   * One borrower, as a risk operator sees them.
   *
   * Exact factor values rather than bands: an operator deciding whether to
   * restrict a line needs the inputs, and bucketing them would make the
   * decision unreviewable.
   */
  async borrower(handle: string): Promise<BorrowerRiskDetailDto> {
    const borrower = await this.prisma.borrower.findUnique({
      where: { handle },
      include: {
        creditLine: true,
        health: true,
        revenueWindow: true,
        assessments: { orderBy: { at: 'desc' }, take: 10 },
        events: { orderBy: { at: 'desc' }, take: 20 },
        anomalies: { orderBy: { detectedAt: 'desc' }, take: 5 },
      },
    });

    if (!borrower?.creditLine || !borrower.health || !borrower.revenueWindow) {
      throw new NotFoundException({
        error: `No borrower is registered under the handle "${handle}".`,
        code: 'borrower_not_found',
        statusCode: 404,
      });
    }

    const { creditLine: credit, health, revenueWindow: revenue } = borrower;

    const [vault, defaults, days] = await Promise.all([
      this.prisma.vaultState.findUnique({ where: { id: 'singleton' } }),
      this.prisma.defaultRecord.count({ where: { borrowerId: borrower.id } }),
      this.prisma.revenueDay.findMany({
        where: { borrowerId: borrower.id },
        orderBy: { date: 'desc' },
        take: 30,
        select: { settled: true },
      }),
    ]);

    const outstanding = await this.prisma.creditLine.aggregate({ _sum: { principal: true } });
    const u = utilization(
      toNumber(outstanding._sum.principal ?? 0),
      toNumber(vault?.availableLiquidity ?? 0),
    );

    const reserveTarget = toNumber(credit.reserveTarget);
    const components = scoreComponents({
      uptimePct: health.uptimePct,
      successPct: health.successPct,
      revenueCv: coefficientOfVariation([...days].reverse().map((d) => toNumber(d.settled))),
      onTimeRatioPct:
        credit.completedCycles > 0
          ? Math.max(0, ((credit.completedCycles - defaults) / credit.completedCycles) * 100)
          : 100,
      completedCycles: credit.completedCycles,
      largestPayerPct: revenue.largestPayerPct,
      hhi: revenue.hhi,
      uniquePayers: revenue.uniquePayers,
      custody: borrower.custody,
      historyDays: credit.historyDays,
      growthPct: revenue.growthPct,
      reserveCoveragePct:
        reserveTarget > 0 ? (toNumber(credit.reserve) / reserveTarget) * 100 : 100,
    });

    // Assessments, detections and money movement in one stream, because an
    // operator reconstructing what happened does not care which table a fact
    // came from — only when it happened relative to everything else.
    const timeline = [
      ...borrower.anomalies.map((a) => ({
        at: a.detectedAt.toISOString(),
        text: `⛔ ${a.kind} detected — ${a.payerCount} payers, ${toNumber(a.washAmount).toFixed(2)} USDC`,
        tx: a.txHash,
      })),
      ...borrower.assessments.map((a) => ({
        at: a.at.toISOString(),
        text: `Assessment — score ${a.score}, limit ${toNumber(a.previousLimit).toFixed(2)} → ${toNumber(a.limitAmount).toFixed(2)} (${a.bindingKey})`,
      })),
      ...borrower.events.map((e) => ({
        at: e.at.toISOString(),
        text: `${e.type} ${e.amount}${e.note ? ` · ${e.note}` : ''}`,
        ...(e.txHash ? { tx: e.txHash } : {}),
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    return {
      handle: borrower.handle,
      serviceName: borrower.serviceName,
      custody: borrower.custody,
      status: credit.status,
      tier: credit.tier,
      score: credit.score,
      scoreDelta: credit.score - credit.previousScore,
      principal: toNumber(credit.principal),
      accruedInterest: toNumber(credit.accruedInterest),
      limit: toNumber(credit.limitAmount),
      reserve: toNumber(credit.reserve),
      repaymentSharePct: credit.repaymentBps / 100,
      ratePct: borrowerRate(u, credit.tier),
      coverageRatio: health.coverageRatio,
      hhi: revenue.hhi,
      factors: {
        S: health.factorS,
        C: health.factorC,
        V: health.factorV,
        D: health.factorD,
        M: health.factorM,
        G: health.factorG,
      },
      components,
      timeline,
      ...(borrower.operator ? { operator: borrower.operator } : {}),
      ...(borrower.jurisdiction ? { jurisdiction: borrower.jurisdiction } : {}),
      ...(borrower.kybVerifiedAt ? { kybVerifiedAt: borrower.kybVerifiedAt.toISOString() } : {}),
    };
  }

  /**
   * A detected manipulation event and the evidence behind it.
   *
   * Returns the most recent when no reference is given, because the operator
   * arriving from an alert wants the one that just fired.
   */
  async anomaly(reference?: string): Promise<AnomalyDetailDto> {
    const row = reference
      ? await this.prisma.anomaly.findUnique({
          where: { reference },
          include: { borrower: { select: { handle: true } } },
        })
      : await this.prisma.anomaly.findFirst({
          orderBy: { detectedAt: 'desc' },
          include: { borrower: { select: { handle: true } } },
        });

    if (!row) {
      throw new NotFoundException({
        error: reference
          ? `No anomaly is recorded under the reference "${reference}".`
          : 'No anomaly has been detected.',
        code: 'anomaly_not_found',
        statusCode: 404,
      });
    }

    return {
      reference: row.reference,
      borrower: row.borrower.handle,
      kind: row.kind,
      detectedAt: row.detectedAt.toISOString(),
      washAmount: toNumber(row.washAmount),
      payerCount: row.payerCount,
      daysSpanned: row.daysSpanned,
      netEconomicRevenue: toNumber(row.netEconomicRevenue),
      evidenceHash: row.evidenceHash,
      txHash: row.txHash,
      // Display-only JSON columns. Prisma types them as opaque `JsonValue`,
      // so the assertion is the boundary where their shape is asserted once.
      evidence: (row.evidence ?? []) as unknown as AnomalyDetailDto['evidence'],
      fundedWallets: (row.fundedWallets ?? []) as unknown as AnomalyDetailDto['fundedWallets'],
      after: {
        eligibleRevenue: toNumber(row.afterEligibleRevenue),
        score: row.afterScore,
        tier: row.afterTier,
        limit: toNumber(row.afterLimit),
        repaymentBps: row.afterRepaymentBps,
      },
    };
  }

  /**
   * The live risk parameters, each with the clause that defines it.
   *
   * Read-only on purpose. Changing a protocol parameter is a governance
   * action with a timelock, not an HTTP PATCH — exposing a mutation here
   * would be the single most dangerous endpoint in the API.
   */
  async parameters(): Promise<RiskParameterDto[]> {
    const vault = await this.prisma.vaultState.findUnique({ where: { id: 'singleton' } });
    const line = await this.prisma.creditLine.findFirst();

    return [
      {
        key: 'repaymentBps',
        label: 'Repayment share',
        value: `${line?.repaymentBps ?? 2000} bps`,
        description: 'Basis points of settled revenue routed to repayment at the router.',
        reference: 'PRD §12.2',
      },
      {
        key: 'reserveBps',
        label: 'Reserve share',
        value: `${line?.reserveBps ?? 200} bps`,
        description: 'Basis points routed to the borrower loss reserve.',
        reference: 'PRD §12.2',
      },
      {
        key: 'exposureCapPct',
        label: 'Per-borrower exposure cap',
        value: `${PER_BORROWER_CAP_PCT}%`,
        description:
          'Maximum share of vault assets a single borrower may hold. Advisory on the ladder; freezes the limit at the next assessment when breached.',
        reference: 'PRD §31.5',
      },
      {
        key: 'firstLossTranche',
        label: 'First-loss tranche',
        value: `${toNumber(vault?.firstLossTranche ?? 0).toFixed(2)} USDC`,
        description: 'Absorbs defaults ahead of liquidity providers.',
        reference: 'PRD §24',
      },
      {
        key: 'bufferFloorPct',
        label: 'Liquidity buffer floor',
        value: `${BUFFER_FLOOR_PCT}%`,
        description:
          'Withdrawals above this enter the FIFO queue rather than draining liquidity the book depends on.',
        reference: 'PRD §23.4',
      },
    ];
  }

  /**
   * Declares a default.
   *
   * The most consequential action in the API: it writes a permanent public
   * record against a named borrower and realises a loss against the vault.
   * Every part of that is audited with the actor, the request id and the
   * evidence hash, because "who declared this, on what basis" has to be
   * answerable months later.
   */
  /**
   * Proposes a default. First signature of the quorum.
   *
   * Writing a default record is the most consequential thing an operator can
   * do — permanent, public, and loss-realising — so it is the one thing a
   * single operator must not be able to do alone (PRD §19.8). The declaration
   * is created pending with the proposer's signature; a second, distinct
   * operator commits it.
   */
  async declareDefault(
    user: SessionUserDto,
    input: DeclareDefaultDto,
    context: { requestId: string; ip?: string },
  ): Promise<DeclarationStatusDto> {
    const borrower = await this.prisma.borrower.findUnique({
      where: { handle: input.handle },
      include: { creditLine: true },
    });

    if (!borrower?.creditLine) {
      throw new NotFoundException({
        error: `No borrower is registered under the handle "${input.handle}".`,
        code: 'borrower_not_found',
        statusCode: 404,
      });
    }

    if (borrower.creditLine.status === 'DEFAULTED') {
      throw new LedgerError(
        `${input.handle} is already in default. Cure it or update the existing record.`,
        'already_defaulted',
      );
    }

    const outstanding = toNumber(borrower.creditLine.principal);
    if (input.principal > outstanding + 1e-9) {
      throw new LedgerError(
        `Declared principal ${input.principal.toFixed(2)} exceeds the outstanding balance of ${outstanding.toFixed(2)}.`,
        'exceeds_outstanding',
      );
    }

    /**
     * One pending declaration per borrower.
     *
     * Deliberately NOT merged: if a second operator proposes different terms,
     * silently adding their signature to the first declaration would commit
     * figures they never saw. Approval has to be an explicit act against a
     * declaration the approver has read.
     */
    const existing = await this.prisma.defaultDeclaration.findFirst({
      where: { borrowerId: borrower.id, status: 'pending' },
      select: { id: true },
    });

    if (existing) {
      throw new LedgerError(
        `A declaration against ${input.handle} is already pending (${existing.id}). Review and approve it, do not open another.`,
        'declaration_pending',
        409,
      );
    }

    const declaration = await this.ledger.run(async (tx) => {
      const created = await tx.defaultDeclaration.create({
        data: {
          borrowerId: borrower.id,
          principal: usdc6(dec(input.principal)),
          trigger: input.trigger,
          evidenceHash: input.evidenceHash,
          approvals: { create: { operator: user.address.toLowerCase() } },
        },
        include: { approvals: true },
      });

      await this.audit.record(
        {
          actor: user.address,
          role: 'ops',
          action: 'risk.default.proposed',
          subject: borrower.handle,
          requestId: context.requestId,
          ip: context.ip,
          metadata: {
            declarationId: created.id,
            principal: input.principal,
            trigger: input.trigger,
            evidenceHash: input.evidenceHash,
          },
        },
        tx,
      );

      return created;
    });

    return this.declarationStatus(declaration, borrower.handle);
  }

  /**
   * Signs a pending declaration. Commits it when the quorum is met.
   *
   * The proposer approving their own declaration again is rejected — the
   * uniqueness of `(declaration, operator)` is what makes two signatures mean
   * two people rather than one person twice.
   */
  async approveDefault(
    user: SessionUserDto,
    declarationId: string,
    context: { requestId: string; ip?: string },
  ): Promise<DeclarationStatusDto> {
    return this.ledger.run(async (tx) => {
      const declaration = await tx.defaultDeclaration.findUnique({
        where: { id: declarationId },
        include: {
          approvals: true,
          borrower: { include: { creditLine: true } },
        },
      });

      if (!declaration) {
        throw new NotFoundException({
          error: `No declaration exists with the id "${declarationId}".`,
          code: 'declaration_not_found',
          statusCode: 404,
        });
      }

      if (declaration.status !== 'pending') {
        throw new LedgerError(
          'This declaration has already been committed.',
          'already_committed',
          409,
        );
      }

      const operator = user.address.toLowerCase();
      if (declaration.approvals.some((approval) => approval.operator === operator)) {
        throw new LedgerError(
          'You have already signed this declaration. A second, distinct operator must approve it.',
          'already_signed',
          409,
        );
      }

      const approval = await tx.defaultApproval.create({
        data: { declarationId: declaration.id, operator },
      });
      const approvals = [...declaration.approvals, approval];

      await this.audit.record(
        {
          actor: user.address,
          role: 'ops',
          action: 'risk.default.approved',
          subject: declaration.borrower.handle,
          requestId: context.requestId,
          ip: context.ip,
          metadata: { declarationId: declaration.id, signatures: approvals.length },
        },
        tx,
      );

      if (approvals.length < DEFAULT_QUORUM) {
        return this.declarationStatus(
          { ...declaration, approvals },
          declaration.borrower.handle,
        );
      }

      /**
       * Re-validated at commit, not only at proposal: settlement repays
       * principal daily, so the balance may have moved between the two
       * signatures. Committing a figure larger than what is now owed would
       * realise a loss that does not exist — the operators re-declare against
       * the current balance instead.
       */
      const outstanding = toNumber(declaration.borrower.creditLine!.principal);
      const principal = toNumber(declaration.principal);
      if (principal > outstanding + 1e-9) {
        throw new LedgerError(
          `The outstanding balance has moved to ${outstanding.toFixed(2)} since this was proposed at ${principal.toFixed(2)}. Re-declare against the current balance.`,
          'exceeds_outstanding',
        );
      }

      await this.commitDefault(tx, declaration, user, context);

      const committed = await tx.defaultDeclaration.update({
        where: { id: declaration.id },
        data: { status: 'committed', committedAt: new Date() },
        include: { approvals: true },
      });

      return this.declarationStatus(committed, declaration.borrower.handle);
    });
  }

  /** Declarations still collecting signatures, oldest first. */
  async pendingDefaults(): Promise<DeclarationStatusDto[]> {
    const rows = await this.prisma.defaultDeclaration.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { approvals: true, borrower: { select: { handle: true } } },
    });

    return rows.map((row) => this.declarationStatus(row, row.borrower.handle));
  }

  /**
   * The write that everything above exists to gate.
   *
   * Runs inside the approval transaction, so the record, the credit-line
   * state, the vault loss and the audit rows land together or not at all.
   */
  private async commitDefault(
    tx: Prisma.TransactionClient,
    declaration: {
      id: string;
      borrowerId: string;
      principal: unknown;
      trigger: string;
      evidenceHash: string;
      borrower: { handle: string; creditLine: { id: string } | null };
    },
    user: SessionUserDto,
    context: { requestId: string; ip?: string },
  ): Promise<void> {
    const principal = toNumber(declaration.principal as never);

    await tx.defaultRecord.create({
      data: {
        borrowerId: declaration.borrowerId,
        principal: usdc6(dec(principal)),
        trigger: declaration.trigger,
        evidenceHash: declaration.evidenceHash,
        automatic: false,
      },
    });

    await tx.creditLine.update({
      where: { id: declaration.borrower.creditLine!.id },
      data: { status: 'DEFAULTED', limitAmount: dec(0), restrictReason: 'binding' },
    });

    const vault = await tx.vaultState.findUnique({ where: { id: 'singleton' } });
    if (vault) {
      await tx.vaultState.update({
        where: { id: vault.id },
        data: {
          realizedLosses: usdc6(dec(vault.realizedLosses).plus(dec(principal))),
          onWatch: Math.max(0, vault.onWatch - 1),
        },
      });
    }

    const txHash = await this.ledger.nextTxHash(tx);
    await this.ledger.recordEvent(tx, {
      type: 'borrower.defaulted',
      who: declaration.borrower.handle,
      amount: `${principal.toFixed(2)} USDC`,
      txHash,
      note: declaration.trigger,
      borrowerId: declaration.borrowerId,
    });

    await this.audit.record(
      {
        actor: user.address,
        role: 'ops',
        action: 'risk.default.declared',
        subject: declaration.borrower.handle,
        requestId: context.requestId,
        ip: context.ip,
        metadata: {
          declarationId: declaration.id,
          principal,
          trigger: declaration.trigger,
          evidenceHash: declaration.evidenceHash,
        },
      },
      tx,
    );
  }

  private declarationStatus(
    declaration: {
      id: string;
      principal: unknown;
      trigger: string;
      status: string;
      createdAt: Date;
      committedAt?: Date | null;
      approvals: Array<{ operator: string }>;
    },
    handle: string,
  ): DeclarationStatusDto {
    const committed = declaration.status === 'committed';

    return {
      id: declaration.id,
      handle,
      principal: toNumber(declaration.principal as never),
      trigger: declaration.trigger,
      status: declaration.status,
      signatures: declaration.approvals.map((approval) => approval.operator),
      required: DEFAULT_QUORUM,
      createdAt: declaration.createdAt.toISOString(),
      ...(declaration.committedAt ? { committedAt: declaration.committedAt.toISOString() } : {}),
      ...(committed
        ? { notice: 'The record is permanent. It may be cured, but no interface path deletes it.' }
        : {}),
    };
  }
}


/** Groups principal by key and sorts by size, largest first. */
function groupPrincipal(
  rows: Array<{ key: string; principal: number }>,
  total: number,
): Array<{ key: string; principal: number; sharePct: number }> {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    buckets.set(row.key, (buckets.get(row.key) ?? 0) + row.principal);
  }

  return [...buckets.entries()]
    .map(([key, principal]) => ({
      key,
      principal,
      sharePct: total > 0 ? Math.round((principal / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.principal - a.principal);
}
