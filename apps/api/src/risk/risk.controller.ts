import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuditService } from '../audit/audit.service';
import type { SessionUserDto } from '../auth/auth.dto';
import { CurrentUser, RequestId, Roles } from '../auth/auth.decorators';
import { ApiErrorDto, PaginationQueryDto } from '../contracts/operations.dto';
import {
  AuditEntryDto,
  DeclareDefaultDto,
  DefaultDeclarationResultDto,
  AnomalyDetailDto,
  BorrowerRiskDetailDto,
  ExposureReportDto,
  LimitRecommendationDto,
  RiskAlertDto,
  RiskParameterDto,
  WatchlistEntryDto,
} from './risk.dto';
import { RiskService } from './risk.service';

/**
 * The risk operator's console.
 *
 * Separately authorised from every other surface: these routes read across all
 * borrowers, which no borrower may do. PRD §33 puts operator access behind its
 * own credentials and a quorum for the destructive actions — the quorum is not
 * implemented here, and is called out in the default-declaration description
 * rather than silently skipped.
 */
@ApiTags('risk')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Requires the `ops` role.' })
@Roles('ops')
@Controller('risk')
export class RiskController {
  constructor(
    private readonly risk: RiskService,
    private readonly audit: AuditService,
  ) {}

  @Get('watchlist')
  @ApiOperation({
    summary: 'Borrowers needing attention',
    description:
      'Anything not cleanly ACTIVE, plus anything whose routed coverage has drifted below 0.90 — coverage falling is the earliest signal that revenue is finding a way around the router.',
  })
  @ApiOkResponse({ type: [WatchlistEntryDto] })
  watchlist(): Promise<WatchlistEntryDto[]> {
    return this.risk.watchlist();
  }

  @Get('exposure')
  @ApiOperation({
    summary: 'Concentration of the book',
    description: 'Outstanding principal by tier, the largest single exposure, and any breach of the per-borrower cap.',
  })
  @ApiOkResponse({ type: ExposureReportDto })
  exposure(): Promise<ExposureReportDto> {
    return this.risk.exposure();
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'The operator alert feed',
    description:
      'Derived from live state rather than stored, so an alert cannot outlive the condition that raised it. Detected anomalies first, then coverage drift, then sector-cap breaches.',
  })
  @ApiOkResponse({ type: [RiskAlertDto] })
  alerts(): Promise<RiskAlertDto[]> {
    return this.risk.alerts();
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Where the ladder disagrees with the limit in force',
    description:
      'Assessments run on a schedule, so a limit always trails its inputs. This is the queue that gap creates, sorted by the size of the disagreement.',
  })
  @ApiOkResponse({ type: [LimitRecommendationDto] })
  recommendations(): Promise<LimitRecommendationDto[]> {
    return this.risk.recommendations();
  }

  @Get('borrower/:handle')
  @ApiOperation({
    summary: 'One borrower, in full',
    description:
      'Position, exact factor values and the score breakdown, plus a merged timeline of assessments, detections and money movement. Payer identities are never included.',
  })
  @ApiParam({ name: 'handle', example: '0x9c4e…a7f1' })
  @ApiOkResponse({ type: BorrowerRiskDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  borrower(@Param('handle') handle: string): Promise<BorrowerRiskDetailDto> {
    return this.risk.borrower(handle);
  }

  @Get('anomaly')
  @ApiOperation({
    summary: 'A detected manipulation event',
    description:
      'The evidence behind a revenue-manipulation finding, and the borrower state it produced. Returns the most recent when `ref` is omitted.',
  })
  @ApiQuery({ name: 'ref', required: false, example: 'A-0142' })
  @ApiOkResponse({ type: AnomalyDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  anomaly(@Query('ref') ref?: string): Promise<AnomalyDetailDto> {
    return this.risk.anomaly(ref);
  }

  @Get('params')
  @ApiOperation({
    summary: 'Live risk parameters',
    description:
      'Read-only, and deliberately so. Changing a protocol parameter is a governance action with a timelock, not an HTTP call — a mutation here would be the most dangerous endpoint in the API. Values are read from `@rivora/core`, so what an operator sees is what the underwriter applies.',
  })
  @ApiOkResponse({ type: [RiskParameterDto] })
  parameters(): Promise<RiskParameterDto[]> {
    return this.risk.parameters();
  }

  @Post('defaults/declare')
  @ApiOperation({
    summary: 'Declare a default',
    description: [
      'Writes a permanent public record against a named borrower, sets the credit line to DEFAULTED and realises the loss against the vault.',
      '',
      'Fully audited: actor, request id, evidence hash and trigger are recorded and cannot be edited or deleted.',
      '',
      '**Not yet implemented:** PRD §33 requires a 2-of-3 operator quorum for this action. Today a single `ops` session is sufficient.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: DefaultDeclarationResultDto })
  @ApiUnprocessableEntityResponse({
    type: ApiErrorDto,
    description: 'Declared principal exceeds the outstanding balance.',
  })
  declareDefault(
    @CurrentUser() user: SessionUserDto,
    @Body() body: DeclareDefaultDto,
    @RequestId() requestId: string,
    @Req() request: Request,
  ): Promise<DefaultDeclarationResultDto> {
    return this.risk.declareDefault(user, body, { requestId, ip: request.ip });
  }

  @Get('audit')
  @ApiOperation({
    summary: 'The audit trail',
    description: 'Append-only record of privileged actions, newest first. There is no delete path.',
  })
  @ApiOkResponse({ type: [AuditEntryDto] })
  async auditTrail(@Query() query: PaginationQueryDto): Promise<AuditEntryDto[]> {
    const rows = await this.audit.list(query.limit ?? 50);

    return rows.map((row) => ({
      at: row.at.toISOString(),
      actor: row.actor,
      action: row.action,
      ...(row.role ? { role: row.role } : {}),
      ...(row.subject ? { subject: row.subject } : {}),
      ...(row.requestId ? { requestId: row.requestId } : {}),
    }));
  }
}
