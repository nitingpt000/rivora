import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ApiKeyScopes, CurrentApiKey, Metered } from '../auth/auth.decorators';
import { ApiErrorDto } from '../contracts/operations.dto';
import { PublicService } from '../public/public.service';
import { ApiUsageDto, SandboxProfileDto, SandboxScoreDto } from './partner.dto';
import { SandboxService } from './sandbox.service';
import { UsageService } from './usage.service';

export class PartnerScoreDto {
  @ApiProperty({ example: '0x9c4e…a7f1' })
  handle: string;

  @ApiProperty({ example: 78, minimum: 0, maximum: 100 })
  score: number;

  @ApiProperty({ enum: ['Prime', 'Strong', 'Standard', 'Restricted', 'Ineligible'] })
  tier: string;

  @ApiProperty({ example: 2, description: 'Whole months of observed history.' })
  monthsObserved: number;

  @ApiProperty({ example: 1 })
  repaymentCycles: number;

  @ApiProperty({ example: 0 })
  defaultsRecorded: number;

  @ApiProperty({ enum: ['A', 'B', 'C'], description: 'How revenue reaches the protocol.' })
  custody: string;

  @ApiProperty({ format: 'date-time' })
  attestedAt: string;

  @ApiProperty({ example: 'riv-uw-2.1' })
  model: string;
}

/**
 * The partner Score API.
 *
 * Authenticated with an API key rather than a wallet session, because the
 * caller is a service rather than a person. Only the SHA-256 of a key is
 * stored, so a database dump does not hand an attacker working credentials.
 *
 * Returns strictly less than the borrower's own view: a score, a tier and
 * counts. No revenue figures, no payer data, no endpoint. A marketplace
 * deciding whether to extend terms needs the judgement, not the order book.
 */
@ApiTags('partner')
@ApiSecurity('api-key')
@ApiKeyScopes('score:read')
@Controller('partner')
export class PartnerController {
  constructor(
    private readonly publicService: PublicService,
    private readonly sandbox: SandboxService,
    private readonly usageService: UsageService,
  ) {}

  @Get('usage')
  @ApiOperation({
    summary: 'What this key has been used for',
    description: [
      'Scoped to the presenting key. There is no parameter that could point this at another caller.',
      '',
      '`billable` counts successful calls on metered routes only — sandbox calls and errors appear in `requests` but are never charged.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'days',
    required: false,
    example: 30,
    description: 'Window length, 1–366 days. Defaults to 30.',
  })
  @ApiOkResponse({ type: ApiUsageDto })
  usage(
    @CurrentApiKey() key: { id: string },
    @Query('days') days?: string,
  ): Promise<ApiUsageDto> {
    return this.usageService.forKey(key.id, days ? Number(days) : undefined);
  }

  @Get('sandbox/profiles')
  @ApiOperation({
    summary: 'Synthetic borrowers available in the sandbox',
    description:
      'Named profiles covering the range of outcomes — prime through ineligible — so an integration can be tested against a restricted borrower without waiting for a real one.',
  })
  @ApiOkResponse({ type: [SandboxProfileDto] })
  profiles(): SandboxProfileDto[] {
    return this.sandbox.profiles();
  }

  @Post('sandbox/score/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Score a synthetic borrower',
    description: [
      'Runs the production underwriter over a synthetic profile. Every figure is computed by the same `@rivora/core` functions that underwrite real borrowers, so the sandbox cannot drift from production.',
      '',
      'Responses carry `sandbox: true` and no underwriter signature — a response lifted from here cannot be replayed as an attestation.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: '07' })
  @ApiOkResponse({ type: SandboxScoreDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  scoreSandbox(@Param('id') id: string): SandboxScoreDto {
    return this.sandbox.score(id);
  }

  @Get('score/:handle')
  // The one route that counts against the plan. Everything else a partner key
  // can reach — the sandbox, the distribution, this key's own usage — is
  // support for the integration rather than the product being sold.
  @Metered()
  // Lower than the global limit: partner keys are for scoring a customer at
  // decision time, not for enumerating the book.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Look up a borrower’s credit standing',
    description: [
      'Requires an API key with the `score:read` scope, sent as `x-api-key`.',
      '',
      'Deliberately narrower than the borrower’s own view: score, tier and counts only. Revenue figures, payer data and the endpoint URL are never returned.',
      '',
      'Rate limited to 60 requests per minute per caller.',
    ].join('\n'),
  })
  @ApiParam({ name: 'handle', example: '0x9c4e…a7f1' })
  @ApiOkResponse({ type: PartnerScoreDto })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'Key is missing, unknown, revoked, or lacks the `score:read` scope.',
  })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async score(@Param('handle') handle: string): Promise<PartnerScoreDto> {
    const card = await this.publicService.reputation(handle);

    return {
      handle: card.handle,
      score: card.score,
      tier: card.tier,
      monthsObserved: card.monthsObserved,
      repaymentCycles: card.repaymentCycles,
      defaultsRecorded: card.defaultsRecorded,
      custody: card.custody,
      attestedAt: card.attestedAt,
      model: card.model,
    };
  }
}
