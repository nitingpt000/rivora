import { Controller, HttpCode, HttpStatus, Post, Req, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuditService } from '../audit/audit.service';
import type { SessionUserDto } from '../auth/auth.dto';
import { CurrentUser, RequestId, Roles } from '../auth/auth.decorators';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';
import { ApiErrorDto, SnapshotOnlyResultDto } from '../contracts/operations.dto';
import { SettlementService } from './settlement.service';

@ApiTags('settlement')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Requires the `ops` role.' })
@Roles('ops')
@Controller('settlement')
export class SettlementController {
  constructor(
    private readonly settlement: SettlementService,
    private readonly audit: AuditService,
  ) {}

  @Post('tick')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Strongly recommended here. A scheduler that retries on timeout would otherwise advance the book twice and accrue a day of interest that never happened.',
  })
  @ApiOperation({
    summary: 'Advance the book by one settlement day',
    description: [
      'Accrues interest, routes the repayment share of settled revenue, tops up the reserve and funds the withdrawal queue.',
      '',
      'A keeper endpoint, restricted to `ops` and deliberately absent from every UI — nothing a user does should move the protocol clock. Audited on each call.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: SnapshotOnlyResultDto })
  async tick(
    @CurrentUser() user: SessionUserDto,
    @RequestId() requestId: string,
    @Req() request: Request,
  ): Promise<SnapshotOnlyResultDto> {
    const result = await this.settlement.tick();

    await this.audit.record({
      actor: user.address,
      role: 'ops',
      action: 'settlement.tick',
      requestId,
      ip: request.ip,
      metadata: { day: result.snapshot.meta.day },
    });

    return result;
  }
}
