import { Body, Controller, HttpCode, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
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
  DrawRequestDto,
  MutationResultDto,
} from '../contracts/operations.dto';
import { CreditService } from './credit.service';

@ApiTags('credit')
@ApiBearerAuth('bearer')
@ApiHeader({
  name: 'Idempotency-Key',
  required: false,
  description:
    'A unique string per operation. A retry with the same key replays the first response instead of moving money twice. Reusing a key with a different body is rejected with `idempotency_key_reused`.',
})
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Requires the `borrower` role.' })
@ApiUnprocessableEntityResponse({
  type: ApiErrorDto,
  description:
    'The request was well formed but the protocol declined it — insufficient credit, blocked status, or no outstanding debt. `code` carries the reason.',
})
@Roles('borrower')
@UseInterceptors(IdempotencyInterceptor)
@Controller('credit')
export class CreditController {
  constructor(private readonly credit: CreditService) {}

  @Post('draw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Draw against the approved limit',
    description:
      'Capacity, borrower status and vault liquidity are all checked server-side rather than in the caller. A draw above the available limit is refused with `exceeds_available`.',
  })
  @ApiOkResponse({ type: MutationResultDto })
  draw(@Body() body: DrawRequestDto): Promise<MutationResultDto> {
    return this.credit.draw(body.amount, body.category);
  }

  @Post('repay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Repay manually',
    description:
      'Applied interest first, then principal. An amount above the outstanding debt is capped rather than refused — overpaying is a reasonable ask, and the excess simply is not taken.',
  })
  @ApiOkResponse({ type: MutationResultDto })
  repay(@Body() body: AmountRequestDto): Promise<MutationResultDto> {
    return this.credit.repay(body.amount);
  }
}
