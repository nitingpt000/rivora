import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

import type { SessionUserDto } from '../auth/auth.dto';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { ApiErrorDto } from '../contracts/operations.dto';
import {
  AgentPolicyDto,
  AssessmentDto,
  AssessmentHistoryEntryDto,
  BorrowerProfileDto,
  CustodyStatusDto,
  EndpointVerificationDto,
  ExcludedRevenueDto,
  NotificationDto,
  ObservationStatusDto,
  PaginationQueryDto,
  RegisterServiceDto,
  ReserveStatusDto,
  RevenueCustomerDto,
  RevenueDetailDto,
  ServiceRegistrationDto,
  UpdatePolicyDto,
  VerifyEndpointDto,
} from './borrower.dto';
import { BorrowerService } from './borrower.service';

class MarkReadDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

/**
 * The borrower's own record.
 *
 * Every route here resolves the borrower from the *session*, never from a
 * path parameter. There is deliberately no `/borrowers/:id` — an endpoint that
 * takes an id is an endpoint someone will eventually call with someone else's.
 */
@ApiTags('borrower')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Missing or invalid session token.' })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'Authenticated, but this wallet has no registered service.',
})
@Roles('borrower')
@Controller()
export class BorrowerController {
  constructor(private readonly borrower: BorrowerService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Registration details',
    description:
      'What the operator registered and what the protocol bound: service, endpoint, custody model, router address and wallets. Changes on registration rather than on settlement.',
  })
  @ApiOkResponse({ type: BorrowerProfileDto })
  profile(@CurrentUser() user: SessionUserDto): Promise<BorrowerProfileDto> {
    return this.borrower.profile(user);
  }

  @Get('observation')
  @ApiOperation({
    summary: 'Progress through the observation window',
    description:
      'Each threshold a new service clears before it can draw, with how far along it is. `eligible` turns true once every requirement passes.',
  })
  @ApiOkResponse({ type: ObservationStatusDto })
  observation(@CurrentUser() user: SessionUserDto): Promise<ObservationStatusDto> {
    return this.borrower.observation(user);
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Trailing 30-day revenue',
    description: 'The underwriting inputs derived from settled payments: eligible and gross totals, growth, concentration and payer mix.',
  })
  @ApiOkResponse({ type: RevenueDetailDto })
  revenue(@CurrentUser() user: SessionUserDto): Promise<RevenueDetailDto> {
    return this.borrower.revenue(user);
  }

  @Get('revenue/customers')
  @ApiOperation({
    summary: 'Revenue by customer',
    description:
      'Pseudonymous labels and shares. Payer addresses are never returned — the concentration factor needs the distribution, not identities.',
  })
  @ApiOkResponse({ type: [RevenueCustomerDto] })
  customers(@CurrentUser() user: SessionUserDto): Promise<RevenueCustomerDto[]> {
    return this.borrower.customers(user);
  }

  @Get('revenue/excluded')
  @ApiOperation({
    summary: 'Revenue excluded from the eligible figure',
    description: 'With the reason for each exclusion, so a borrower can act on it rather than guess.',
  })
  @ApiOkResponse({ type: ExcludedRevenueDto })
  excluded(@CurrentUser() user: SessionUserDto): Promise<ExcludedRevenueDto> {
    return this.borrower.excluded(user);
  }

  @Get('credit/assessment')
  @ApiOperation({
    summary: 'The constraint ladder behind the current limit',
    description:
      'Every candidate limit with the binding rung flagged, plus the per-factor haircut. Recomputed from live inputs — PRD §14.5: a borrower told only the final number will optimise the wrong metric.',
  })
  @ApiOkResponse({ type: AssessmentDto })
  assessment(@CurrentUser() user: SessionUserDto): Promise<AssessmentDto> {
    return this.borrower.assessment(user);
  }

  @Get('credit/history')
  @ApiOperation({ summary: 'Past assessments, newest first' })
  @ApiOkResponse({ type: [AssessmentHistoryEntryDto] })
  history(
    @CurrentUser() user: SessionUserDto,
    @Query() query: PaginationQueryDto,
  ): Promise<AssessmentHistoryEntryDto[]> {
    return this.borrower.assessmentHistory(user, query.limit ?? 50);
  }

  @Get('custody')
  @ApiOperation({
    summary: 'Router binding and revenue routing',
    description: 'The screen that makes the credit legible as safe: binding state, coverage ratio and the waterfall split.',
  })
  @ApiOkResponse({ type: CustodyStatusDto })
  custody(@CurrentUser() user: SessionUserDto): Promise<CustodyStatusDto> {
    return this.borrower.custody(user);
  }

  @Post('custody/restore-binding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-verify a repaired router binding',
    description:
      'Restores the limit held when the restriction landed. Refused with `binding_ok` if the binding was never broken.',
  })
  @ApiOkResponse({ type: CustodyStatusDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorDto })
  restoreBinding(@CurrentUser() user: SessionUserDto): Promise<CustodyStatusDto> {
    return this.borrower.restoreBinding(user);
  }

  @Get('policy')
  @ApiOperation({ summary: 'The agent wallet policy draws are spent within' })
  @ApiOkResponse({ type: AgentPolicyDto })
  policy(@CurrentUser() user: SessionUserDto): Promise<AgentPolicyDto> {
    return this.borrower.policy(user);
  }

  @Patch('policy')
  @ApiOperation({
    summary: 'Change the agent policy',
    description:
      'Tightening applies immediately; widening takes effect after the configured delay, so a compromised agent cannot raise its own ceiling and drain the line in the same minute. Check `pendingChangeAt` in the response.',
  })
  @ApiOkResponse({ type: AgentPolicyDto })
  updatePolicy(
    @CurrentUser() user: SessionUserDto,
    @Body() body: UpdatePolicyDto,
  ): Promise<AgentPolicyDto> {
    return this.borrower.updatePolicy(user, body);
  }

  @Get('reserve')
  @ApiOperation({ summary: 'Loss-reserve balance and contribution rate' })
  @ApiOkResponse({ type: ReserveStatusDto })
  reserve(@CurrentUser() user: SessionUserDto): Promise<ReserveStatusDto> {
    return this.borrower.reserve(user);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Alerts for this borrower, newest first' })
  @ApiOkResponse({ type: [NotificationDto] })
  notifications(
    @CurrentUser() user: SessionUserDto,
    @Query() query: PaginationQueryDto,
  ): Promise<{ notifications: NotificationDto[]; unread: number; total: number }> {
    return this.borrower.notifications(user, query.limit ?? 50, query.offset ?? 0);
  }

  @Post('notifications/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark alerts read',
    description: 'Omit `ids` to mark everything read. Scoped to the caller’s own alerts.',
  })
  @ApiBody({ type: MarkReadDto, required: false })
  @ApiOkResponse({ schema: { properties: { updated: { type: 'number', example: 3 } } } })
  markRead(
    @CurrentUser() user: SessionUserDto,
    @Body() body: MarkReadDto,
  ): Promise<{ updated: number }> {
    return this.borrower.markNotificationsRead(user, body?.ids);
  }

  @Post('services/verify-endpoint')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Probe an endpoint',
    description:
      'Resolves the host, reads the 402 challenge and compares the advertised `payTo` against the deployed router. Returns the staged log so a borrower can see which check failed, not merely that verification did.',
  })
  @ApiOkResponse({ type: EndpointVerificationDto })
  verifyEndpoint(
    @CurrentUser() user: SessionUserDto,
    @Body() body: VerifyEndpointDto,
  ): Promise<EndpointVerificationDto> {
    return this.borrower.verifyEndpoint(user, body.endpoint);
  }
}

/**
 * Registration, split out because it is the one borrower route a wallet
 * *without* a borrower role must be able to call.
 */
@ApiTags('borrower')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('services')
export class ServiceRegistrationController {
  constructor(private readonly borrower: BorrowerService) {}

  @Post()
  @ApiOperation({
    summary: 'Register a service',
    description:
      'Creates the borrower record, links it to the signed-in wallet and opens the 30-day observation window. No role is required — this is how a wallet becomes a borrower.',
  })
  @ApiOkResponse({ type: ServiceRegistrationDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'This wallet already has a registered service.',
  })
  register(
    @CurrentUser() user: SessionUserDto,
    @Body() body: RegisterServiceDto,
  ): Promise<ServiceRegistrationDto> {
    return this.borrower.register(user, body);
  }
}
