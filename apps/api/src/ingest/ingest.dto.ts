import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One payer's contribution to a settled day.
 *
 * Pseudonymous by contract: the indexer resolves a wallet to a stable label
 * before it gets here, so the API never stores a payer address. The
 * concentration and diversity factors need the distribution, not identities.
 */
export class IngestPayerDto {
  @ApiProperty({ example: 'payer-01', description: 'Stable pseudonym. Never an address.' })
  @IsString()
  @Length(1, 64)
  label: string;

  @ApiProperty({ example: 184.5, description: 'Settled to this payer on the day, USDC.' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  amount: number;

  @ApiProperty({ example: 4_612 })
  @IsInt()
  @Min(0)
  requests: number;

  @ApiPropertyOptional({
    example: false,
    description: 'True when this payer is excluded from the eligible base.',
  })
  @IsOptional()
  @IsBoolean()
  excluded?: boolean;

  @ApiPropertyOptional({
    example: 'Payer age below 7 days',
    description: 'Required in practice when excluded — PRD §22.2 requires a reason per exclusion.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  exclusionReason?: string;
}

/**
 * A day of settled revenue, as the indexer observed it.
 *
 * One request per borrower per day. Re-posting the same day overwrites it
 * rather than adding to it: settlement is netted per day, so a corrected batch
 * replaces the earlier reading instead of double-counting it.
 */
export class IngestRevenueDto {
  @ApiProperty({ example: '0x9c4e…a7f1', description: 'Borrower handle.' })
  @IsString()
  @Length(1, 128)
  handle: string;

  @ApiProperty({ example: '2026-08-03', description: 'Settlement date, UTC. Date only.' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 833.42, description: 'Total settled on the day, USDC.' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  settled: number;

  @ApiProperty({ example: 20_835, description: 'Paid requests fulfilled on the day.' })
  @IsInt()
  @Min(0)
  requests: number;

  @ApiPropertyOptional({
    example: 412,
    description:
      'Paid requests the service failed to fulfil. Optional, and its absence is read as "not reported" rather than as zero — a service that never reports failures should not be scored as though it had none.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  failed?: number;

  @ApiPropertyOptional({
    example: 12.4,
    description: 'Revenue refunded on the day, USDC. Feeds the refund rate.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  refunded?: number;

  @ApiPropertyOptional({
    example: 441,
    description:
      'Portion of the settled total that arrived through the Revenue Router, USDC. Feeds the routed-coverage ratio (PRD §11.5). Omit rather than send zero when routing was not observed — absence is read as "not reported", and a zero would read as "diverted".',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  routed?: number;

  @ApiPropertyOptional({
    type: [IngestPayerDto],
    description:
      'Per-payer breakdown. Without it the day still counts toward revenue, but concentration and diversity cannot be recomputed from it.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2_000)
  @ValidateNested({ each: true })
  @Type(() => IngestPayerDto)
  payers?: IngestPayerDto[];
}

export class IngestResultDto {
  @ApiProperty({ example: '0x9c4e…a7f1' })
  handle: string;

  @ApiProperty({ example: '2026-08-03' })
  date: string;

  @ApiProperty({ example: 833.42, description: 'Settled revenue recorded for the day.' })
  settled: number;

  @ApiProperty({ example: 38.6, description: 'Portion excluded from the eligible base.' })
  excluded: number;

  @ApiProperty({
    example: true,
    description: 'True when this replaced an earlier reading for the same day.',
  })
  replaced: boolean;

  @ApiProperty({ example: 14040, description: 'Eligible revenue over the window after the write.' })
  windowEligible: number;

  @ApiProperty({
    example: true,
    description:
      'True when the window moved enough to trigger an assessment. PRD §16.6 lists a material revenue change as a trigger.',
  })
  reassessed: boolean;
}

/** How many days a caller may backfill in one request. */
export class IngestBatchDto {
  @ApiProperty({ type: [IngestRevenueDto] })
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => IngestRevenueDto)
  days: IngestRevenueDto[];
}
