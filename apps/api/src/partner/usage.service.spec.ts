import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { UsageService } from './usage.service';

interface Row {
  at: Date;
  status: number;
  subjectHandle: string | null;
  billable: boolean;
  durationMs: number;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    at: new Date('2026-08-02T12:00:00.000Z'),
    status: 200,
    subjectHandle: '0xaaaa',
    billable: true,
    durationMs: 10,
    ...overrides,
  };
}

interface Query {
  where: { apiKeyId?: string; at: { gte: Date; lt: Date } };
}

function serviceWith(rows: Row[]) {
  const findMany = vi.fn(async (_query: Query) => rows);
  const prisma = { apiKeyUsage: { findMany } } as unknown as PrismaService;
  return { service: new UsageService(prisma), findMany };
}

/** The query the service issued on its nth call. */
function queryAt(findMany: ReturnType<typeof serviceWith>['findMany'], n: number): Query {
  const call = findMany.mock.calls[n];
  if (!call) throw new Error(`no query was issued at index ${n}`);
  return call[0];
}

function windowDays(query: Query): number {
  return Math.round((query.where.at.lt.getTime() - query.where.at.gte.getTime()) / 86_400_000);
}

describe('UsageService', () => {
  it('scopes the query to the presenting key', async () => {
    const { service, findMany } = serviceWith([]);
    await service.forKey('key-1');

    // The key comes from the guard, never from a parameter. If this ever
    // widens, one caller can read another's bill.
    expect(queryAt(findMany, 0).where.apiKeyId).toBe('key-1');
  });

  it('counts every request but bills only the metered successes', async () => {
    const { service } = serviceWith([
      row({ billable: true }),
      row({ billable: true }),
      // A sandbox call: succeeded, but not a metered route.
      row({ billable: false, subjectHandle: null }),
      // A failed lookup.
      row({ billable: false, status: 404, subjectHandle: '0xbbbb' }),
    ]);

    const usage = await service.forKey('key-1');

    expect(usage.requests).toBe(4);
    expect(usage.billable).toBe(2);
  });

  it('counts a repeatedly scored borrower as one subject', async () => {
    const { service } = serviceWith([
      row({ subjectHandle: '0xaaaa' }),
      row({ subjectHandle: '0xaaaa' }),
      row({ subjectHandle: '0xbbbb' }),
    ]);

    expect((await service.forKey('key-1')).uniqueSubjects).toBe(2);
  });

  it('does not bill a subject whose lookup found nothing', async () => {
    const { service } = serviceWith([
      row({ subjectHandle: '0xaaaa', billable: true }),
      row({ subjectHandle: '0xghost', billable: false, status: 404 }),
    ]);

    // Naming a handle is not the same as being sold a score for it.
    expect((await service.forKey('key-1')).uniqueSubjects).toBe(1);
  });

  it('computes the error rate over every request, not the successful ones', async () => {
    const { service } = serviceWith([
      row({ status: 200 }),
      row({ status: 200 }),
      row({ status: 200 }),
      row({ status: 500, billable: false }),
    ]);

    expect((await service.forKey('key-1')).errorRatePct).toBe(25);
  });

  it('reports median latency rather than mean', async () => {
    // One cold start should not be reported as the latency every caller saw.
    const { service } = serviceWith([
      row({ durationMs: 5 }),
      row({ durationMs: 6 }),
      row({ durationMs: 900 }),
    ]);

    expect((await service.forKey('key-1')).medianLatencyMs).toBe(6);
  });

  it('buckets by UTC day, oldest first', async () => {
    const { service } = serviceWith([
      row({ at: new Date('2026-08-01T23:00:00.000Z') }),
      row({ at: new Date('2026-08-02T01:00:00.000Z') }),
      row({ at: new Date('2026-08-02T02:00:00.000Z'), billable: false }),
    ]);

    expect((await service.forKey('key-1')).byDay).toEqual([
      { date: '2026-08-01', requests: 1, billable: 1 },
      { date: '2026-08-02', requests: 2, billable: 1 },
    ]);
  });

  it('reports zeroes rather than dividing by nothing on an unused key', async () => {
    const { service } = serviceWith([]);
    const usage = await service.forKey('key-1');

    expect(usage.requests).toBe(0);
    expect(usage.errorRatePct).toBe(0);
    expect(usage.medianLatencyMs).toBe(0);
    expect(usage.lastUsedAt).toBeUndefined();
  });

  it('clamps the window so a caller cannot ask for an unbounded scan', async () => {
    const { service, findMany } = serviceWith([]);

    await service.forKey('key-1', 100_000);
    expect(windowDays(queryAt(findMany, 0))).toBe(366);

    await service.forKey('key-1', 0);
    expect(windowDays(queryAt(findMany, 1))).toBe(1);
  });
});
