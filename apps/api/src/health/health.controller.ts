import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import type { HealthCheckResult } from '@nestjs/terminus';

import { Public } from '../auth/auth.decorators';
import { ChainService } from '../chain/chain.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public, and it has to be.
 *
 * Authentication is global, so this needs an explicit opt-out — a container
 * orchestrator has no wallet to sign with, and a gated healthcheck reports a
 * perfectly healthy process as unhealthy until it is restarted forever.
 *
 * It reveals only whether the process is up and whether the database answers.
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness and database readiness',
    description:
      'Pings the database rather than only reporting that the process is up — the container orchestrator needs to know the API can actually serve, not just that it answered.',
  })
  @ApiOkResponse({ description: 'All checks passing.' })
  @ApiServiceUnavailableResponse({ description: 'At least one check failed.' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', this.prisma),
      // Reports whether money movement is hitting the chain or the database.
      // Always "up" — it is a statement of mode, not a liveness probe — but
      // surfacing it means nobody has to guess which one is in force.
      () => Promise.resolve({ chain: { status: 'up' as const, mode: this.chain.mode } }),
    ]);
  }
}
