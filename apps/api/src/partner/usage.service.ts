import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { ApiUsageDto, PartnerConsoleDto } from './partner.dto';

/** Longest window a caller may ask for, in days. */
const MAX_WINDOW_DAYS = 366;

/** Default window when none is given. */
const DEFAULT_WINDOW_DAYS = 30;

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * What one key has been used for, over a window.
   *
   * Aggregated from the per-request rows rather than from a counter, so it can
   * answer "this month" — which is the only question a bill actually asks. The
   * key id comes from the guard that authenticated the request, never from a
   * parameter, so there is no shape of call that reports someone else's usage.
   */
  async forKey(apiKeyId: string, days = DEFAULT_WINDOW_DAYS): Promise<ApiUsageDto> {
    return this.aggregate({ apiKeyId }, days);
  }

  /**
   * The console view: every key a wallet owns, aggregated.
   *
   * A partner signs in with a wallet, not with a key — so the console reports
   * on the keys that wallet issued. A wallet owning no keys gets an empty
   * window rather than an error: having issued none is a normal state.
   */
  async forOwner(ownerAddress: string, days = DEFAULT_WINDOW_DAYS): Promise<PartnerConsoleDto> {
    const owner = ownerAddress.toLowerCase();

    const keys = await this.prisma.apiKey.findMany({
      where: { ownerAddress: owner },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        label: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    const usage = await this.aggregate(
      { apiKey: { ownerAddress: owner } },
      days,
    );

    return {
      keys: keys.map((key) => ({
        label: key.label,
        prefix: key.prefix,
        scopes: key.scopes,
        active: key.revokedAt === null,
        createdAt: key.createdAt.toISOString(),
        ...(key.lastUsedAt ? { lastUsedAt: key.lastUsedAt.toISOString() } : {}),
      })),
      usage,
    };
  }

  private async aggregate(
    scope: Prisma.ApiKeyUsageWhereInput,
    days: number,
  ): Promise<ApiUsageDto> {
    const window = Math.min(Math.max(1, Math.floor(days)), MAX_WINDOW_DAYS);

    const to = new Date();
    const from = new Date(to.getTime() - window * 86_400_000);

    const rows = await this.prisma.apiKeyUsage.findMany({
      where: { ...scope, at: { gte: from, lt: to } },
      select: { at: true, status: true, subjectHandle: true, billable: true, durationMs: true },
      orderBy: { at: 'asc' },
    });

    const requests = rows.length;
    const billable = rows.filter((row) => row.billable).length;
    const errors = rows.filter((row) => row.status >= 400).length;

    // Distinct borrowers, not distinct rows: a plan priced per subject charges
    // once for a borrower looked up a thousand times.
    //
    // Billable rows only. A 404 names a handle but returned no score, and
    // charging for a lookup that found nothing is charging for nothing.
    const subjects = new Set(
      rows.filter((row) => row.billable).map((row) => row.subjectHandle).filter(Boolean),
    );

    const byDay = new Map<string, { requests: number; billable: number }>();
    for (const row of rows) {
      const date = row.at.toISOString().slice(0, 10);
      const bucket = byDay.get(date) ?? { requests: 0, billable: 0 };
      bucket.requests += 1;
      if (row.billable) bucket.billable += 1;
      byDay.set(date, bucket);
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      requests,
      billable,
      uniqueSubjects: subjects.size,
      errorRatePct: requests > 0 ? Math.round((errors / requests) * 10_000) / 100 : 0,
      // Median rather than mean: one cold start should not be reported as the
      // latency every caller experiences.
      medianLatencyMs: median(rows.map((row) => row.durationMs)),
      ...(rows.length ? { lastUsedAt: rows[rows.length - 1]!.at.toISOString() } : {}),
      byDay: [...byDay.entries()].map(([date, bucket]) => ({ date, ...bucket })),
    };
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}
