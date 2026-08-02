import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { VaultPerformanceDto } from '../vault/vault.dto';

/**
 * Public shapes.
 *
 * What is *absent* here is the design. Aggregate protocol health is public;
 * an individual borrower's outstanding balance, an LP's wallet balance, payer
 * addresses and endpoint URLs are not. Each of these types is the deliberate
 * subset a stranger may read.
 */

export class ProtocolStatsDto {
  @ApiProperty({ example: 25000, description: 'Total value locked, USDC.' })
  totalValueLocked: number;

  @ApiProperty({ example: 8470, description: 'Outstanding principal across every borrower.' })
  outstandingCredit: number;

  @ApiProperty({ example: 0.3388, description: '0–1.' })
  utilization: number;

  @ApiProperty({ example: 7 })
  activeBorrowers: number;

  @ApiProperty({ example: 1 })
  onWatch: number;

  @ApiProperty({ example: 41280 })
  routedRevenue30d: number;

  @ApiProperty({ example: 6190 })
  principalRepaid: number;

  @ApiProperty({ example: 0 })
  realizedLosses: number;

  @ApiProperty({ example: 0, description: 'Defaulted principal over originated principal, percent.' })
  defaultRatePct: number;

  @ApiProperty({ example: 100, description: 'Share of repayment that came from routed revenue.' })
  repaidFromRevenuePct: number;

  @ApiProperty({ example: 60, description: 'Settlement days processed.' })
  day: number;

  @ApiProperty({ example: 'Arc Testnet' })
  network: string;

  @ApiProperty({ example: '2026-08-02T14:31:07.000Z', format: 'date-time' })
  asOf: string;

  @ApiProperty({ example: 12500, description: 'First-loss capital ahead of depositors, USDC.' })
  firstLossTranche: number;

  @ApiProperty({ example: 5.1, description: 'First-loss tranche as a share of vault assets.' })
  firstLossCoveragePct: number;

  @ApiProperty({ example: 13500, description: 'Eligible revenue across every borrower, USDC.' })
  eligibleRevenue: number;

  @ApiProperty({ example: 412000, description: 'Paid requests observed across the protocol.' })
  authorizationsIssued: number;

  @ApiProperty({ example: 99.2, description: 'Mean fulfilment rate across borrowers.' })
  probeSuccessPct: number;

  @ApiProperty({ example: 99.7 })
  meanUptimePct: number;

  @ApiProperty({
    type: VaultPerformanceDto,
    description:
      'Vault yield and coverage. The same figures the LP surface reports — quoted from one place so the landing page cannot advertise a different APY. Concentration is omitted: the book’s composition is for depositors, not for a stranger.',
  })
  vault: Omit<VaultPerformanceDto, 'byCustody' | 'bySector' | 'upstream'>;
}

export class ReputationBandDto {
  @ApiProperty({ example: 'Service reliability' })
  label: string;

  @ApiProperty({ enum: ['HIGH', 'MODERATE', 'LOW', 'STRUCTURAL'], example: 'HIGH' })
  band: string;
}

/**
 * A borrower's public credit record.
 *
 * Bands, not figures. Revenue totals, payer identities, per-customer splits
 * and the endpoint URL are all withheld: the point of a reputation card is to
 * let a counterparty judge reliability without handing them a competitor's
 * order book.
 */
export class ReputationCardDto {
  @ApiProperty({ example: '0x9c4e…a7f1' })
  handle: string;

  @ApiProperty({ example: '0x3b7d…e922', description: 'Hash of the endpoint binding, not the URL.' })
  endpointHash: string | null;

  @ApiProperty({ example: 78 })
  score: number;

  @ApiProperty({ enum: ['Prime', 'Strong', 'Standard', 'Restricted', 'Ineligible'] })
  tier: string;

  @ApiProperty({ example: 2, description: 'Whole months of observed history.' })
  monthsObserved: number;

  @ApiProperty({ example: 1 })
  repaymentCycles: number;

  @ApiProperty({ example: 100 })
  onTimeRatioPct: number;

  @ApiProperty({ example: 6190, description: 'Cumulative principal repaid, USDC.' })
  principalRepaid: number;

  @ApiProperty({ example: 0 })
  defaultsRecorded: number;

  @ApiProperty({ enum: ['A', 'B', 'C'], example: 'A' })
  custody: string;

  @ApiProperty({ type: [ReputationBandDto] })
  bands: ReputationBandDto[];

  @ApiProperty({ example: '2026-08-02T14:00:00.000Z', format: 'date-time' })
  attestedAt: string;

  @ApiProperty({ example: 'riv-uw-2.1' })
  model: string;
}

export class DefaultRecordDto {
  @ApiProperty({ example: '0x4c30…f18b' })
  borrower: string;

  @ApiProperty({ example: '2026-07-14T00:00:00.000Z', format: 'date-time' })
  declaredAt: string;

  @ApiPropertyOptional({ example: '2026-07-29T00:00:00.000Z', format: 'date-time' })
  curedAt?: string;

  @ApiProperty({ example: 1850 })
  principal: number;

  @ApiProperty({ example: 1850 })
  recovered: number;

  @ApiProperty({ enum: ['CURED', 'UNCURED'], example: 'CURED' })
  status: string;

  @ApiProperty({ example: 'coverage ratio 0.31' })
  trigger: string;

  @ApiProperty({ example: '0x6d20…be15' })
  evidenceHash: string;

  @ApiProperty({ example: true, description: 'Declared by the protocol rather than by an operator.' })
  automatic: boolean;

  @ApiProperty({ example: 15, nullable: true, description: 'Days from declaration to cure.' })
  daysToCure: number | null;
}

export class DefaultRegistryDto {
  @ApiProperty({ type: [DefaultRecordDto] })
  records: DefaultRecordDto[];

  @ApiProperty({ example: 2 })
  count: number;

  @ApiProperty({ example: 6050 })
  totalPrincipal: number;

  @ApiProperty({ example: 2810 })
  totalRecovered: number;

  @ApiProperty({ example: 46.4 })
  recoveryRatePct: number;

  @ApiProperty({ example: 50 })
  cureRatePct: number;
}

/**
 * How the scored population sits across tiers.
 *
 * Public because it is counts only. A reader learns the shape of the book
 * without learning who is in it — the same line the reputation card draws.
 */
export class TierDistributionDto {
  @ApiProperty({ enum: ['Prime', 'Strong', 'Standard', 'Restricted', 'Ineligible'] })
  tier: string;

  @ApiProperty({ example: 41.1 })
  sharePct: number;

  @ApiProperty({ example: 774, description: 'Borrowers in this band.' })
  subjects: number;
}
