import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/auth.decorators';
import { ApiErrorDto } from '../contracts/operations.dto';
import { ActivityEventDto } from '../contracts/snapshot.dto';
import { SnapshotService } from '../snapshot/snapshot.service';
import {
  DefaultRegistryDto,
  ProtocolStatsDto,
  ReputationCardDto,
  TierDistributionDto,
} from './public.dto';
import { PublicService } from './public.service';

/**
 * Everything readable without a wallet.
 *
 * The boundary is drawn on purpose: aggregate protocol health, a borrower's
 * reputation bands and the default registry are public, because a credit
 * protocol that hides its loss record is not worth trusting. Individual
 * positions, payer identities and endpoint URLs are not, and live behind
 * authentication in the other modules.
 */
@ApiTags('public')
@Public()
@Controller()
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly snapshots: SnapshotService,
  ) {}

  @Get('protocol/stats')
  @ApiOperation({
    summary: 'Aggregate protocol state',
    description:
      'What the landing page shows a stranger: TVL, utilization, borrower counts, routed revenue and the loss record. Contains no individual position — for that, authenticate and call `/snapshot`.',
  })
  @ApiOkResponse({ type: ProtocolStatsDto })
  stats(): Promise<ProtocolStatsDto> {
    return this.publicService.stats();
  }

  @Get('activity')
  @ApiOperation({
    summary: 'The public event stream',
    description:
      'Newest first. Payer addresses, per-customer revenue, endpoint URLs and borrower legal identity never appear here.',
  })
  @ApiOkResponse({ type: [ActivityEventDto] })
  async activity(): Promise<{ events: ActivityEventDto[] }> {
    return { events: await this.snapshots.recentEvents() };
  }

  @Get('reputation/:handle')
  @ApiOperation({
    summary: "A borrower's public credit record",
    description:
      'Bands rather than figures. Revenue totals, payer identities, per-customer splits and the endpoint URL are withheld — a counterparty should be able to judge reliability without receiving a competitor’s order book.',
  })
  @ApiParam({ name: 'handle', example: '0x9c4e…a7f1' })
  @ApiOkResponse({ type: ReputationCardDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  reputation(@Param('handle') handle: string): Promise<ReputationCardDto> {
    return this.publicService.reputation(handle);
  }

  @Get('distribution')
  @ApiOperation({
    summary: 'How the scored population sits across tiers',
    description:
      'Counts only — no handles, no revenue. Lets a reader judge where a given score sits relative to the rest of the book.',
  })
  @ApiOkResponse({ type: [TierDistributionDto] })
  distribution(): Promise<TierDistributionDto[]> {
    return this.publicService.tierDistribution();
  }

  @Get('defaults')
  @ApiOperation({
    summary: 'The permanent default registry',
    description:
      'Public by design: the registry’s value to a third party depends on it being non-negotiable. A default may be cured, but no interface path deletes a record.',
  })
  @ApiOkResponse({ type: DefaultRegistryDto })
  defaults(): Promise<DefaultRegistryDto> {
    return this.publicService.defaults();
  }
}
