import { Body, Controller, HttpCode, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../auth/auth.decorators';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';
import { ApiErrorDto } from '../contracts/operations.dto';
import { IngestBatchDto, IngestResultDto, IngestRevenueDto } from './ingest.dto';
import { IngestService } from './ingest.service';

/**
 * Where settled revenue enters the protocol. PRD §25.1.
 *
 * Operator-authenticated because the caller is the indexer, not a borrower: a
 * borrower who could post their own revenue could post whatever number they
 * wanted, which would undo the entire premise that revenue is observed rather
 * than reported.
 *
 * The window aggregates — eligible, growth, HHI, concentration — are derived
 * from what is posted, never accepted from it.
 */
@ApiTags('ingest')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'This wallet is not an operator.' })
@Roles('ops')
@Controller('ingest')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post('revenue')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Record a settled day of revenue',
    description: [
      'One day per borrower. Re-posting the same date replaces that day rather than adding to it — settlement is netted per day, and a retried batch must not double-count.',
      '',
      'Recomputes the underwriting window from every day on file, and triggers an assessment when eligible revenue moves 10% or more. PRD §16.6 lists a material revenue change as an assessment trigger.',
    ].join('\n'),
  })
  @ApiHeader({
    name: 'idempotency-key',
    required: false,
    description: 'Replays the first response rather than recording the day twice.',
  })
  @ApiOkResponse({ type: IngestResultDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  revenue(@Body() body: IngestRevenueDto): Promise<IngestResultDto> {
    return this.ingest.record(body);
  }

  @Post('revenue/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Backfill a range of days',
    description:
      'Applied in order, so the window is correct after the last one lands. Intended for seeding a borrower’s history at registration, not for steady-state settlement.',
  })
  @ApiBody({ type: IngestBatchDto })
  @ApiOkResponse({ type: [IngestResultDto] })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async batch(@Body() body: IngestBatchDto): Promise<IngestResultDto[]> {
    const results: IngestResultDto[] = [];

    // Sequential on purpose: each day recomputes the window from every day on
    // file, so concurrent writes would race on the same aggregate row.
    for (const day of body.days) {
      results.push(await this.ingest.record(day));
    }

    return results;
  }
}
