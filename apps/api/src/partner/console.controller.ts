import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { SessionUserDto } from '../auth/auth.dto';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { ApiErrorDto } from '../contracts/operations.dto';
import { PartnerConsoleDto } from './partner.dto';
import { UsageService } from './usage.service';

/**
 * The partner console, read by a person rather than a service.
 *
 * Separate from `PartnerController` because the credential is different: that
 * one takes an API key because the caller is a machine scoring a customer;
 * this one takes a wallet session because the caller is whoever issued the
 * key and wants to see what it has been doing.
 *
 * Scoped to the keys the signed-in wallet owns. There is no parameter naming
 * an owner, so no shape of call reports another partner's usage.
 */
@ApiTags('partner')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'This wallet is not a partner.' })
@Roles('partner')
@Controller('partner/console')
export class PartnerConsoleController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  @ApiOperation({
    summary: 'The caller’s keys and what they have been used for',
    description: [
      'Keys are returned by prefix only — the key itself is shown once at issue and never again.',
      '',
      'Usage is aggregated across every key the signed-in wallet owns. `billable` counts successful calls on metered routes; sandbox calls and errors appear in `requests` but are never charged.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'days',
    required: false,
    example: 30,
    description: 'Window length, 1–366 days. Defaults to 30.',
  })
  @ApiOkResponse({ type: PartnerConsoleDto })
  console(
    @CurrentUser() user: SessionUserDto,
    @Query('days') days?: string,
  ): Promise<PartnerConsoleDto> {
    return this.usage.forOwner(user.address, days ? Number(days) : undefined);
  }
}
