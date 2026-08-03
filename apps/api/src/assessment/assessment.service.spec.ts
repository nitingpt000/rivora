import { describe, expect, it, vi } from 'vitest';

import type { LedgerService } from '../ledger/ledger.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AssessmentService } from './assessment.service';

interface Day {
  settled: number;
  excluded: number;
}

function borrower(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    handle: '0xtest',
    custody: 'A' as const,
    creditLine: {
      id: 'c1',
      status: 'ACTIVE' as const,
      tier: 'Standard' as const,
      score: 70,
      previousScore: 66,
      limitAmount: 2_000,
      previousLimit: 1_500,
      reserve: 240,
      reserveTarget: 250,
      repaymentBps: 2_000,
      completedCycles: 3,
      historyDays: 90,
    },
    revenueWindow: {
      eligible: 13_500,
      largestPayerPct: 14,
      hhi: 650,
      uniquePayers: 36,
      growthPct: 12,
    },
    health: {
      uptimePct: 99.4,
      successPct: 96.2,
      factorS: 0.95,
      factorC: 0.86,
      factorV: 0.9,
      factorD: 0.95,
      factorM: 0.88,
      factorG: 1.1,
    },
    ...overrides,
  };
}

function serviceWith(days: Day[]) {
  const prisma = {
    vaultState: { findUnique: vi.fn(async () => ({ totalAssets: 25_000, day: 60 })) },
    defaultRecord: { count: vi.fn(async () => 0) },
    revenueDay: { findMany: vi.fn(async () => days) },
  } as unknown as PrismaService;

  const ledger = { run: vi.fn(), nextTxHash: vi.fn() } as unknown as LedgerService;
  return new AssessmentService(prisma, ledger);
}

/** A steady 30-day series summing to 13,500. */
const STEADY: Day[] = Array.from({ length: 30 }, () => ({ settled: 450, excluded: 0 }));

describe('AssessmentService.compute', () => {
  it('scores and limits a steady borrower', async () => {
    const result = await serviceWith(STEADY).compute(borrower() as never);

    expect(result.score).toBeGreaterThan(0);
    expect(result.limit).toBeGreaterThan(0);
    expect(result.bindingKey).toBeTruthy();
  });

  it('derives the tier from the score it just computed', async () => {
    // Not from the tier on file — a borrower who has improved must not be
    // underwritten against their old band.
    const stale = borrower({
      creditLine: { ...borrower().creditLine, tier: 'Ineligible' as const },
    });

    const result = await serviceWith(STEADY).compute(stale as never);
    expect(result.tier).not.toBe('Ineligible');
  });

  it('components sum to the score', async () => {
    const result = await serviceWith(STEADY).compute(borrower() as never);
    const total = result.components.reduce((sum, c) => sum + c.contribution, 0);

    expect(Math.abs(total - result.score)).toBeLessThan(1);
  });

  it('clamps a manufactured spike out of the limit base', async () => {
    // PRD §13.2: raw revenue is trivially inflated by a single spike day, so
    // the base is median-clamped before it reaches the ladder.
    const spiked: Day[] = [
      ...Array.from({ length: 29 }, () => ({ settled: 450, excluded: 0 })),
      { settled: 20_000, excluded: 0 },
    ];

    const steady = await serviceWith(STEADY).compute(borrower() as never);
    const burst = await serviceWith(spiked).compute(borrower() as never);

    // The spike is 44x a normal day. Without the clamp it would multiply the
    // base — and therefore the limit — several times over.
    expect(burst.limit).toBeLessThanOrEqual(steady.limit * 2);
  });

  it('nets exclusions out of the base, day by day', async () => {
    const withExclusions: Day[] = Array.from({ length: 30 }, () => ({
      settled: 450,
      excluded: 150,
    }));

    const clean = await serviceWith(STEADY).compute(borrower() as never);
    const dirty = await serviceWith(withExclusions).compute(borrower() as never);

    expect(dirty.limit).toBeLessThan(clean.limit);
  });

  it('reports the limit currently in force as the previous one', async () => {
    // Not `previousLimit` from the row — that is the assessment before last,
    // and using it would make every delta on the credit screen wrong.
    const result = await serviceWith(STEADY).compute(borrower() as never);
    expect(result.previousLimit).toBe(2_000);
  });
});

describe('AssessmentService.dueForReassessment', () => {
  function serviceWithAssessments(rows: Array<{ atDay: number }[]>) {
    const prisma = {
      borrower: {
        findMany: vi.fn(async () =>
          rows.map((assessments, i) => ({ id: `b${i}`, assessments })),
        ),
      },
    } as unknown as PrismaService;

    return new AssessmentService(prisma, {} as LedgerService);
  }

  it('is due when the interval has elapsed in settlement days', async () => {
    const service = serviceWithAssessments([[{ atDay: 46 }]]);
    expect(await service.dueForReassessment(60)).toEqual(['b0']);
  });

  it('is not due before the interval', async () => {
    const service = serviceWithAssessments([[{ atDay: 50 }]]);
    expect(await service.dueForReassessment(60)).toEqual([]);
  });

  it('treats a never-assessed borrower as due immediately', async () => {
    // That is the first approval. Waiting out the interval to grant it would
    // run the observation window twice.
    const service = serviceWithAssessments([[]]);
    expect(await service.dueForReassessment(1)).toEqual(['b0']);
  });
});
