import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
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
  DeclarationStatusDto,
  DeclareDefaultDto,
  AnomalyDetailDto,
  BorrowerRiskDetailDto,
  ExposureReportDto,
  LimitRecommendationDto,
  ReinstateDto,
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
 * own credentials and a quorum for the destructive actions. Declaring a
 * default takes two distinct operator signatures: one proposes, another
 * approves, and the permanent record commits only at quorum.
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

  @Post('borrower/:handle/reassess')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force an assessment now',
    description: [
      'Runs the underwriter immediately rather than waiting for the scheduled interval. PRD §16.6 lists the triggers that justify this: a material revenue change, a default warning, a large refund, suspicious activity, or a completed repayment.',
      '',
      'Writes an assessment record either way. A borrower who is RESTRICTED or DEFAULTED keeps the limit their status imposed — an assessment cannot hand credit back to a borrower a risk decision just took it from.',
    ].join('\n'),
  })
  @ApiParam({ name: 'handle', example: '0x9c4e…a7f1' })
  @ApiOkResponse({ type: BorrowerRiskDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async reassess(@Param('handle') handle: string): Promise<BorrowerRiskDetailDto> {
    await this.risk.reassess(handle);
    return this.risk.borrower(handle);
  }

  @Post('borrower/:handle/reinstate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lift a restriction',
    description: [
      'Returns a RESTRICTED or WATCH borrower to ACTIVE and resets the repayment share to its normal level.',
      '',
      'Detection is automatic; lifting is not. Protecting the book from a borrower inflating their own revenue should not wait for somebody to be awake, and releasing a borrower from that judgement should never happen because a number drifted back over a line.',
      '',
      'The limit is **not** restored — it stays at zero until an assessment sets it, so a reinstated borrower is underwritten again rather than handed back the number they held before the finding.',
    ].join('\n'),
  })
  @ApiParam({ name: 'handle', example: '0x9c4e…a7f1' })
  @ApiOkResponse({ type: BorrowerRiskDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async reinstate(
    @Param('handle') handle: string,
    @Body() body: ReinstateDto,
    @CurrentUser() user: SessionUserDto,
  ): Promise<BorrowerRiskDetailDto> {
    await this.risk.reinstate(handle, user.address, body.note);
    return this.risk.borrower(handle);
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
    summary: 'Propose a default',
    description: [
      'First signature of the quorum. The declaration is created pending; a second, distinct operator commits it via `POST /risk/defaults/:id/approve`, which writes the permanent record, sets the credit line to DEFAULTED and realises the loss against the vault (PRD §19.8).',
      '',
      'One pending declaration per borrower — a second proposal is refused rather than merged, because merging would attach a signature to figures the second operator never saw.',
      '',
      'Fully audited at every step: proposer, approvers, request ids, evidence hash and trigger are recorded and cannot be edited or deleted.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: DeclarationStatusDto })
  @ApiUnprocessableEntityResponse({
    type: ApiErrorDto,
    description: 'Declared principal exceeds the outstanding balance.',
  })
  declareDefault(
    @CurrentUser() user: SessionUserDto,
    @Body() body: DeclareDefaultDto,
    @RequestId() requestId: string,
    @Req() request: Request,
  ): Promise<DeclarationStatusDto> {
    return this.risk.declareDefault(user, body, { requestId, ip: request.ip });
  }

  @Post('defaults/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign a pending declaration',
    description: [
      'Adds this operator’s signature. When the quorum is met the record commits atomically: the permanent default record, the DEFAULTED credit line, the realised vault loss and the audit rows land together or not at all.',
      '',
      'The proposer signing again is refused — two signatures must mean two people. The declared principal is re-validated at commit, because settlement repays principal daily and the balance may have moved between signatures.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 'clx8f2k9a0000' })
  @ApiOkResponse({ type: DeclarationStatusDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  approveDefault(
    @CurrentUser() user: SessionUserDto,
    @Param('id') id: string,
    @RequestId() requestId: string,
    @Req() request: Request,
  ): Promise<DeclarationStatusDto> {
    return this.risk.approveDefault(user, id, { requestId, ip: request.ip });
  }

  @Get('defaults/pending')
  @ApiOperation({
    summary: 'Declarations still collecting signatures',
    description: 'Oldest first, with who has signed each. The second operator’s worklist.',
  })
  @ApiOkResponse({ type: [DeclarationStatusDto] })
  pendingDefaults(): Promise<DeclarationStatusDto[]> {
    return this.risk.pendingDefaults();
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
