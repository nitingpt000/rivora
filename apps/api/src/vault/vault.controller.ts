import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { Roles } from '../auth/auth.decorators';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';
import {
  AmountRequestDto,
  ApiErrorDto,
  MutationResultDto,
  SnapshotOnlyResultDto,
} from '../contracts/operations.dto';
import { VaultPerformanceDto, VaultPortfolioDto } from './vault.dto';
import { VaultService } from './vault.service';

@ApiTags('vault')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Requires the `lp` role.' })
@Roles('lp')
@Controller('vault')
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  @Get('portfolio')
  @ApiOperation({
    summary: 'The caller’s vault position',
    description: 'Shares held, current value, amount earned, and anything sitting in the exit queue.',
  })
  @ApiOkResponse({ type: VaultPortfolioDto })
  portfolio(): Promise<VaultPortfolioDto> {
    return this.vault.portfolio();
  }

  @Get('performance')
  @ApiOperation({
    summary: 'Yield decomposition',
    description:
      'Separates organic yield from the protocol subsidy on purpose. A displayed APY that silently blends the two overstates what the vault earns, and the subsidy has an end date.',
  })
  @ApiOkResponse({ type: VaultPerformanceDto })
  performance(): Promise<VaultPerformanceDto> {
    return this.vault.performance();
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary: 'Supply USDC and mint vault shares',
    description: 'Shares are minted at the current share price. Lowers utilization for everyone.',
  })
  @ApiOkResponse({ type: MutationResultDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorDto })
  deposit(@Body() body: AmountRequestDto): Promise<MutationResultDto> {
    return this.vault.deposit(body.amount);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary: 'Redeem shares',
    description:
      'Serves what liquidity above the buffer floor allows and queues the rest, so a successful response can report less than was requested. Check `receipt.queued`.',
  })
  @ApiOkResponse({ type: MutationResultDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorDto })
  withdraw(@Body() body: AmountRequestDto): Promise<MutationResultDto> {
    return this.vault.withdraw(body.amount);
  }

  @Post('queue/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim the funded portion of a queued exit' })
  @ApiOkResponse({ type: SnapshotOnlyResultDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorDto })
  claim(): Promise<SnapshotOnlyResultDto> {
    return this.vault.claimQueue();
  }

  @Post('queue/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a queued exit',
    description: 'Shares and interest accrual resume from the moment of cancellation.',
  })
  @ApiOkResponse({ type: SnapshotOnlyResultDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorDto })
  cancel(): Promise<SnapshotOnlyResultDto> {
    return this.vault.cancelQueue();
  }
}
