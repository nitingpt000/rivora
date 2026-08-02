import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actor: string;
  role?: Role | null;
  action: string;
  subject?: string;
  requestId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only record of privileged actions.
 *
 * Risk-operator decisions move other people's money and write records that
 * cannot be deleted, so "who declared this default, and when" has to be
 * answerable months later. There is deliberately no update or delete path.
 *
 * Writes never fail the request that triggered them: refusing to declare a
 * default because the audit table was briefly unavailable would be the wrong
 * trade, so a failure is logged loudly instead.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, client?: Prisma.TransactionClient): Promise<void> {
    const db = client ?? this.prisma;

    try {
      await db.auditLog.create({
        data: {
          actor: entry.actor,
          role: entry.role ?? null,
          action: entry.action,
          subject: entry.subject ?? null,
          requestId: entry.requestId ?? null,
          ip: entry.ip ?? null,
          metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (cause) {
      this.logger.error(
        `Failed to write audit entry for ${entry.action} by ${entry.actor}: ${String(cause)}`,
      );
    }
  }

  /** Most recent entries, newest first. Operator-visible. */
  list(limit = 50): Promise<Prisma.AuditLogGetPayload<object>[]> {
    return this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: Math.min(limit, 200) });
  }
}
