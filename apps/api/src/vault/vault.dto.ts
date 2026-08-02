import { ApiProperty } from '@nestjs/swagger';

export class VaultPortfolioDto {
  @ApiProperty({ example: '0x8e11…4c73' })
  address: string;

  @ApiProperty({ example: 4962.31 })
  shares: number;

  @ApiProperty({ example: 1.007597 })
  sharePrice: number;

  @ApiProperty({ example: 5000, description: 'Current value of the position, USDC.' })
  value: number;

  @ApiProperty({ example: 5000, description: 'Cumulative amount supplied.' })
  supplied: number;

  @ApiProperty({ example: 37.99, description: 'Value less amount supplied. May be negative.' })
  earned: number;

  @ApiProperty({ example: 12400 })
  walletBalance: number;

  @ApiProperty({ example: 0, description: 'Sitting in the FIFO exit queue.' })
  queued: number;

  @ApiProperty({ example: 0, description: 'Part of the queued amount already funded.' })
  queueFunded: number;

  @ApiProperty({ example: 19.85, description: 'Share of total vault assets, percent.' })
  shareOfVaultPct: number;
}

export class CustodyConcentrationDto {
  @ApiProperty({ enum: ['A', 'B', 'C'] })
  model: string;

  @ApiProperty({ example: 7630 })
  principal: number;

  @ApiProperty({ example: 90.1 })
  sharePct: number;
}

export class SectorConcentrationDto {
  @ApiProperty({ example: 'Data lookup and static datasets' })
  sector: string;

  @ApiProperty({ example: 3940 })
  principal: number;

  @ApiProperty({ example: 46.5 })
  sharePct: number;

  @ApiProperty({ example: 40 })
  capPct: number;

  @ApiProperty({ example: true })
  breached: boolean;
}

export class UpstreamConcentrationDto {
  @ApiProperty({ example: 'Model provider A' })
  name: string;

  @ApiProperty({ example: 'compute' })
  category: string;

  @ApiProperty({ example: 4930, description: 'Principal exposed through this dependency, USDC.' })
  principal: number;

  @ApiProperty({ example: 58.2 })
  sharePct: number;

  @ApiProperty({ example: false })
  substitutable: boolean;
}

export class VaultPerformanceDto {
  @ApiProperty({ example: 6, description: 'What the vault displays, subsidy included.' })
  displayedApyPct: number;

  @ApiProperty({ example: 3.08, description: 'Earned from borrower interest alone.' })
  organicApyPct: number;

  @ApiProperty({
    example: 2.92,
    description: 'Paid from the protocol subsidy. Ends on the date below and is not guaranteed.',
  })
  subsidyApyPct: number;

  @ApiProperty({ example: '2026-10-30', description: 'When the subsidy stops.' })
  subsidyEnds: string;

  @ApiProperty({ example: 12.1, description: 'Blended rate paid by borrowers.' })
  blendedBorrowerRatePct: number;

  @ApiProperty({ example: 3, description: 'Protocol’s share of borrower interest.' })
  protocolSpreadPct: number;

  @ApiProperty({ example: 184.2 })
  interestGenerated: number;

  @ApiProperty({ example: 0 })
  realizedLosses: number;

  @ApiProperty({ example: 4.9, description: 'First-loss cover over realised losses to date.' })
  coverageMultiple: number;

  @ApiProperty({ example: 26, description: 'Weighted mean days to repay the book.' })
  weightedMeanPaybackDays: number;

  @ApiProperty({ example: 5.5, description: 'Protocol’s cut of interest to date, USDC.' })
  protocolSpreadTaken: number;

  @ApiProperty({ example: 120.4, description: 'Subsidy paid into the vault to date, USDC.' })
  subsidyPaidIn: number;

  @ApiProperty({ example: 299.1, description: 'Interest plus subsidy, less the spread.' })
  netToLps: number;

  @ApiProperty({ example: 16_660, description: 'Principal originated over the vault’s life.' })
  principalOriginated: number;

  @ApiProperty({
    type: [CustodyConcentrationDto],
    description: 'Principal by custody model — how much of the book repayment is structural for.',
  })
  byCustody: CustodyConcentrationDto[];

  @ApiProperty({
    type: [SectorConcentrationDto],
    description:
      'Principal by service category. An LP funds the whole book, so its concentration is theirs.',
  })
  bySector: SectorConcentrationDto[];

  @ApiProperty({
    type: [UpstreamConcentrationDto],
    description:
      'Measured across borrowers — two services reselling one provider are one risk, and diversifying across borrowers does not fix it.',
  })
  upstream: UpstreamConcentrationDto[];
}
