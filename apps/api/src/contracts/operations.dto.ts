import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '@rivora/api-client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { ProtocolSnapshotDto } from './snapshot.dto';

export class SessionResponseDto {
  @ApiProperty({ example: '0x5d92a10f4c3b8e7d6a2f9c04e1b83750d6ab3ba6', nullable: true })
  address: string | null;

  @ApiProperty({
    enum: ['borrower', 'lp', 'ops', 'partner'],
    nullable: true,
    description: 'Null when the address is not registered — the client shows a role picker.',
  })
  role: Role | null;

  @ApiProperty({ example: '/dashboard', nullable: true, description: 'Landing route for the role.' })
  home: string | null;

  @ApiProperty({ example: true })
  known: boolean;
}

export class ReceiptDto {
  @ApiProperty({ enum: ['draw', 'repay', 'deposit', 'withdraw'] })
  kind: 'draw' | 'repay' | 'deposit' | 'withdraw';

  @ApiProperty({ example: 400, description: 'Amount actually moved, which may be less than requested.' })
  amount: number;

  @ApiPropertyOptional({ example: 0, description: 'Portion of a withdrawal placed in the FIFO queue.' })
  queued?: number;

  @ApiPropertyOptional({ example: 4962.31, description: 'Vault shares minted on deposit.' })
  shares?: number;

  @ApiPropertyOptional({ example: false })
  clearsDebt?: boolean;

  @ApiProperty({ example: '0x9e37…0000' })
  tx: string;
}

/**
 * A completed state change and the snapshot it produced.
 *
 * The whole snapshot rather than a patch: the client then either holds the
 * server's state or knows the call failed, and there is no merge to get wrong.
 */
export class MutationResultDto {
  @ApiProperty({ type: ReceiptDto })
  receipt: ReceiptDto;

  @ApiProperty({ type: ProtocolSnapshotDto })
  snapshot: ProtocolSnapshotDto;
}

export class SnapshotOnlyResultDto {
  @ApiProperty({ type: ProtocolSnapshotDto })
  snapshot: ProtocolSnapshotDto;
}

export class ActivityResponseDto {
  @ApiProperty({ type: [Object], description: 'Most recent protocol events, newest first.' })
  events: unknown[];
}

/**
 * Amounts are bounded on the way in.
 *
 * The upper bound is not a business rule — the vault's own liquidity check is
 * — it exists so an absurd or hostile figure is rejected by the validation
 * pipe before it reaches decimal arithmetic.
 */
export class AmountRequestDto {
  @ApiProperty({ example: 400, minimum: 0.000001, description: 'USDC, to six decimal places.' })
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'amount must be a number with at most 6 decimal places' })
  @Min(0.000001, { message: 'amount must be greater than zero' })
  @Max(1_000_000_000, { message: 'amount is implausibly large' })
  amount: number;
}

export class DrawRequestDto extends AmountRequestDto {
  @ApiProperty({
    example: 'Model and data API expenses',
    description: 'Recorded against the draw and checked against the wallet policy.',
  })
  @IsString()
  @IsIn([
    'Model and data API expenses',
    'Compute',
    'Storage',
    'Security & monitoring',
    'Devops',
    'Uncategorised',
  ])
  category: string;
}

export class RegisterServiceRequestDto {
  @ApiProperty({ example: 'QuoteStream Market Data API' })
  @IsString()
  serviceName: string;

  @ApiProperty({ example: 'https://api.quotestream.dev/v1' })
  @IsString()
  endpoint: string;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C'], example: 'A' })
  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  custody?: string;
}

/**
 * Shared list-query parameters.
 *
 * `limit` is capped rather than unbounded: an endpoint that will return every
 * row on request is a denial-of-service primitive that looks like a feature.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/** The body of any non-2xx response. */
export class ApiErrorDto {
  @ApiProperty({ example: 'Requested 99999.00 exceeds available credit of 530.00.' })
  error: string;

  @ApiProperty({
    example: 'exceeds_available',
    description: 'Machine-readable reason, for branching in the client.',
  })
  code: string;

  @ApiProperty({ example: 422 })
  statusCode: number;
}
