import { ApiProperty } from '@nestjs/swagger';

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
