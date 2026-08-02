import { Injectable, NotFoundException } from '@nestjs/common';
import type { CustodyModel, Tier } from '@rivora/core';
import {
  calculateLimit,
  compositeScore,
  concentrationBand,
  scoreComponents,
  TIER_ADVANCE_RATE,
  TIER_MAX_HORIZON_DAYS,
  tierForScore,
} from '@rivora/core';

import type { SandboxProfileDto, SandboxScoreDto } from './partner.dto';

/**
 * Named borrower profiles for the Score API sandbox.
 *
 * Synthetic on purpose, and that is what separates them from fixtures: an
 * integrator needs to see how the endpoint answers for a restricted borrower
 * and for one with detected wash activity, and neither can be arranged on
 * demand against real borrowers. The scores below are not stored — every field
 * of the response is computed by the same `@rivora/core` functions that
 * underwrite production, so the sandbox cannot drift from the real thing.
 */
const PROFILES = [
  {
    id: '01',
    description: 'Prime, low concentration, custody A',
    signals: {
      uptimePct: 99.8,
      successPct: 99.4,
      revenueCv: 0.08,
      onTimeRatioPct: 100,
      completedCycles: 8,
      largestPayerPct: 9,
      hhi: 340,
      uniquePayers: 520,
      custody: 'A' as CustodyModel,
      historyDays: 240,
      growthPct: 18,
      reserveCoveragePct: 100,
    },
    revenue30d: 62_000,
  },
  {
    id: '04',
    description: 'Standard, high concentration, custody B',
    signals: {
      uptimePct: 98.1,
      successPct: 96.2,
      revenueCv: 0.31,
      onTimeRatioPct: 92,
      completedCycles: 3,
      largestPayerPct: 38,
      hhi: 1_980,
      uniquePayers: 41,
      custody: 'B' as CustodyModel,
      historyDays: 95,
      growthPct: 6,
      reserveCoveragePct: 72,
    },
    revenue30d: 21_000,
  },
  {
    id: '07',
    description: 'Standard, verified costs, custody A',
    signals: {
      uptimePct: 99.1,
      successPct: 98.0,
      revenueCv: 0.19,
      onTimeRatioPct: 100,
      completedCycles: 2,
      largestPayerPct: 21,
      hhi: 900,
      uniquePayers: 128,
      custody: 'A' as CustodyModel,
      historyDays: 62,
      growthPct: 12,
      reserveCoveragePct: 88,
    },
    revenue30d: 13_500,
  },
  {
    id: '09',
    description: 'Restricted, coverage ratio 0.62',
    signals: {
      uptimePct: 94.0,
      successPct: 91.5,
      revenueCv: 0.48,
      onTimeRatioPct: 66,
      completedCycles: 3,
      largestPayerPct: 41,
      hhi: 2_240,
      uniquePayers: 22,
      custody: 'C' as CustodyModel,
      historyDays: 110,
      growthPct: -14,
      reserveCoveragePct: 35,
    },
    revenue30d: 8_400,
  },
  {
    id: '12',
    description: 'Ineligible, wash activity detected',
    signals: {
      uptimePct: 88.0,
      successPct: 84.0,
      revenueCv: 0.72,
      onTimeRatioPct: 20,
      completedCycles: 1,
      largestPayerPct: 62,
      hhi: 4_100,
      uniquePayers: 6,
      custody: 'C' as CustodyModel,
      historyDays: 34,
      growthPct: -38,
      reserveCoveragePct: 0,
    },
    revenue30d: 2_900,
  },
] as const;

@Injectable()
export class SandboxService {
  /** The synthetic borrowers an integrator can score against. */
  profiles(): SandboxProfileDto[] {
    return PROFILES.map((profile) => ({
      id: profile.id,
      description: profile.description,
      endpoint: `https://sandbox.rivora.dev/synthetic/${profile.id}`,
    }));
  }

  /**
   * Scores a synthetic borrower with the production underwriter.
   *
   * The signature and evidence hash are the one part that is not real: a
   * sandbox response is deliberately not signed by the production underwriter
   * key, so a response lifted from here cannot be replayed as an attestation.
   */
  score(id: string): SandboxScoreDto {
    const profile = PROFILES.find((p) => p.id === id);

    if (!profile) {
      throw new NotFoundException({
        error: `No synthetic borrower is defined with the id "${id}".`,
        code: 'sandbox_profile_not_found',
        statusCode: 404,
      });
    }

    const score = compositeScore(profile.signals);
    const tier: Tier = tierForScore(score);
    const components = scoreComponents(profile.signals);

    // The five quality factors the limit ladder consumes, read from the same
    // normalised signals rather than restated.
    const value = (key: string) =>
      components.find((component) => component.key === key)?.value ?? 1;
    const factors = {
      S: value('reliability'),
      C: value('concentration'),
      V: value('consistency'),
      D: value('diversity'),
      M: 1,
      G: value('growth'),
    };

    const decision = calculateLimit({
      normalizedRevenue30d: profile.revenue30d,
      tier,
      factors,
      custody: profile.signals.custody,
      repaymentBps: 2_000,
      previousLimit: 0,
      // A sandbox borrower competes for no real liquidity, so the exposure
      // rung is given room rather than binding on an unrelated vault balance.
      vaultAssets: profile.revenue30d * 100,
      historyDays: profile.signals.historyDays,
      completedCycles: profile.signals.completedCycles,
    });

    return {
      score,
      tier,
      recommendedLimit: decision.limit,
      bindingKey: decision.bindingKey,
      maxAdvanceRate: TIER_ADVANCE_RATE[tier],
      maxHorizonDays: TIER_MAX_HORIZON_DAYS[tier],
      reliabilityBand: bandFor(value('reliability')),
      concentrationBand: concentrationBand(profile.signals.hhi),
      custodyModel: profile.signals.custody,
      confidence: confidenceFor(profile.signals.historyDays, profile.signals.completedCycles),
      components,
      modelVersion: 'riv-uw-2.1',
      sandbox: true,
    };
  }
}

function bandFor(value: number): string {
  if (value >= 0.9) return 'HIGH';
  if (value >= 0.75) return 'MODERATE';
  return 'LOW';
}

/**
 * How much weight to place on the assessment.
 *
 * Short history and few completed cycles mean the inputs are thin, not that
 * the borrower is bad — reported separately so an integrator can require a
 * confidence floor rather than reading a provisional score as settled.
 */
function confidenceFor(historyDays: number, completedCycles: number): number {
  const tenure = Math.min(1, historyDays / 180);
  const record = Math.min(1, completedCycles / 6);
  return Math.round((0.4 + 0.35 * tenure + 0.25 * record) * 100) / 100;
}
