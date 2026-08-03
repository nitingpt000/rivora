import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ScoreComponentDto } from '../borrower/borrower.dto';

export class SandboxProfileDto {
  @ApiProperty({ example: '07' })
  id: string;

  @ApiProperty({ example: 'Standard, verified costs, custody A' })
  description: string;

  @ApiProperty({ example: 'https://sandbox.rivora.dev/synthetic/07' })
  endpoint: string;
}

/**
 * A sandbox scoring response.
 *
 * Shaped like the production attestation but explicitly marked `sandbox`, and
 * deliberately unsigned — a response lifted from here must not be replayable
 * as a real attestation.
 */
export class SandboxScoreDto {
  @ApiProperty({ example: 78, minimum: 0, maximum: 100 })
  score: number;

  @ApiProperty({ enum: ['Prime', 'Strong', 'Standard', 'Restricted', 'Ineligible'] })
  tier: string;

  @ApiProperty({ example: 2530 })
  recommendedLimit: number;

  @ApiProperty({ example: 'growthCap', description: 'Which rung of the ladder decided the limit.' })
  bindingKey: string;

  @ApiProperty({ example: 0.25 })
  maxAdvanceRate: number;

  @ApiProperty({ example: 45 })
  maxHorizonDays: number;

  @ApiProperty({ enum: ['HIGH', 'MODERATE', 'LOW'] })
  reliabilityBand: string;

  @ApiProperty({ enum: ['LOW', 'MODERATE', 'ELEVATED', 'HIGH'] })
  concentrationBand: string;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  custodyModel: string;

  @ApiProperty({
    example: 0.74,
    description:
      'How much weight to place on the assessment. Low confidence means thin inputs, not a bad borrower.',
  })
  confidence: number;

  @ApiProperty({ type: [ScoreComponentDto] })
  components: ScoreComponentDto[];

  @ApiProperty({ example: 'riv-uw-2.1' })
  modelVersion: string;

  @ApiProperty({
    example: true,
    description: 'Always true here. Sandbox responses carry no underwriter signature.',
  })
  sandbox: boolean;
}

export class UsageDayDto {
  @ApiProperty({ example: '2026-08-02', description: 'Date, UTC.' })
  date: string;

  @ApiProperty({ example: 412 })
  requests: number;

  @ApiProperty({ example: 398 })
  billable: number;
}

/**
 * What a partner key has been used for, over a window.
 *
 * Scoped to the presenting key. There is no route that reports another
 * caller's usage, and no parameter that could be pointed at one.
 */
export class ApiUsageDto {
  @ApiProperty({ format: 'date-time', description: 'Start of the window, inclusive.' })
  from: string;

  @ApiProperty({ format: 'date-time', description: 'End of the window, exclusive.' })
  to: string;

  @ApiProperty({ example: 14210, description: 'Every request the key made, including failures.' })
  requests: number;

  @ApiProperty({
    example: 13980,
    description:
      'Successful calls on metered routes. Sandbox calls and errors are counted above but never charged.',
  })
  billable: number;

  @ApiProperty({
    example: 1884,
    description: 'Distinct borrowers looked up. What a per-subject plan is priced on.',
  })
  uniqueSubjects: number;

  @ApiProperty({ example: 0.04, description: 'Share of requests that returned 4xx or 5xx.' })
  errorRatePct: number;

  @ApiProperty({ example: 46, description: 'Median round-trip the caller saw, milliseconds.' })
  medianLatencyMs: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'Most recent call.' })
  lastUsedAt?: string;

  @ApiProperty({ type: [UsageDayDto], description: 'Daily totals, oldest first.' })
  byDay: UsageDayDto[];
}

/** A key the caller owns. Never the key itself — only its non-secret prefix. */
export class ApiKeySummaryDto {
  @ApiProperty({ example: 'AgentMarket Inc' })
  label: string;

  @ApiProperty({ example: 'pk_test_riv', description: 'Leading characters, for recognition.' })
  prefix: string;

  @ApiProperty({ example: ['score:read'], type: [String] })
  scopes: string[];

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiPropertyOptional({ format: 'date-time' })
  lastUsedAt?: string;
}

/** What the partner console reads: the caller's keys and their combined usage. */
export class PartnerConsoleDto {
  @ApiProperty({ type: [ApiKeySummaryDto] })
  keys: ApiKeySummaryDto[];

  @ApiProperty({ type: ApiUsageDto, description: 'Aggregated across every key above.' })
  usage: ApiUsageDto;
}
