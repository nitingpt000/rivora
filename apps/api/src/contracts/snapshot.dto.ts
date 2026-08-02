import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BorrowerStatus, CustodyModel, Tier } from '@rivora/core';

/**
 * The wire contract, decorated for OpenAPI.
 *
 * These mirror the interfaces in `@rivora/api-client`, which the web client
 * compiles against. The duplication is deliberate and load-bearing: Swagger
 * builds its schema from decorator metadata, and decorators cannot be attached
 * to an interface. A compile-time assertion at the bottom of this file fails
 * the build if the two ever drift, so the copy cannot silently rot.
 */

export class BorrowerPositionDto {
  @ApiProperty({ example: '0x9c4e…a7f1', description: 'Public protocol handle.' })
  id: string;

  @ApiProperty({
    enum: ['OBSERVATION', 'ELIGIBLE', 'ACTIVE', 'WATCH', 'RESTRICTED', 'DELINQUENT', 'DEFAULTED', 'REPAID'],
    example: 'ACTIVE',
  })
  status: BorrowerStatus;

  @ApiProperty({ enum: ['Prime', 'Strong', 'Standard', 'Restricted', 'Ineligible'], example: 'Strong' })
  tier: Tier;

  @ApiProperty({ example: 78, minimum: 0, maximum: 100 })
  score: number;

  @ApiProperty({ example: 68, description: 'Score at the previous assessment.' })
  previousScore: number;

  @ApiProperty({ example: 2530, description: 'Approved credit limit, USDC.' })
  limit: number;

  @ApiProperty({ example: 1690, description: 'Limit approved at the previous assessment.' })
  previousLimit: number;

  @ApiProperty({ example: 2000, description: 'Outstanding principal, USDC.' })
  principal: number;

  @ApiProperty({ example: 8.42 })
  accruedInterest: number;

  @ApiProperty({ example: 0 })
  pendingDraws: number;

  @ApiProperty({ example: 248.6 })
  reserve: number;

  @ApiProperty({ example: 253 })
  reserveTarget: number;

  @ApiProperty({ example: 2000, description: 'Basis points of settled revenue routed to repayment.' })
  repaymentBps: number;

  @ApiProperty({ example: 200, description: 'Basis points routed to the loss reserve.' })
  reserveBps: number;

  @ApiProperty({ example: 1 })
  completedCycles: number;

  @ApiProperty({ example: 60 })
  historyDays: number;

  @ApiProperty({ enum: ['A', 'B', 'C'], example: 'A' })
  custody: CustodyModel;

  @ApiProperty({
    enum: ['revenue', 'concentration', ''],
    example: '',
    description: 'Empty when the borrower is not on watch.',
  })
  watchReason: 'revenue' | 'concentration' | '';

  @ApiProperty({ enum: ['circular', 'binding', ''], example: '' })
  restrictReason: 'circular' | 'binding' | '';

  @ApiProperty({ example: false })
  anomalyDetected: boolean;
}

export class RevenueMetricsDto {
  @ApiProperty({ example: 13500, description: 'Eligible trailing 30-day revenue, USDC.' })
  eligible: number;

  @ApiProperty({ example: 14040 })
  gross: number;

  @ApiProperty({ example: 540, description: 'Revenue excluded by the anomaly filters.' })
  excluded: number;

  @ApiProperty({ example: 450, description: 'Mean settled revenue per day.' })
  dailyMean: number;

  @ApiProperty({ example: 35 })
  growthPct: number;

  @ApiProperty({ example: 14, description: 'Share of revenue from the single largest payer.' })
  largestPayerPct: number;

  @ApiProperty({ example: 0.14, description: 'Herfindahl-Hirschman index of payer concentration.' })
  hhi: number;

  @ApiProperty({ example: 386 })
  uniquePayers: number;

  @ApiProperty({ example: 168 })
  repeatPayers: number;
}

export class QualityFactorsDto {
  @ApiProperty({ example: 0.95, description: 'Service reliability.' })
  S: number;

  @ApiProperty({ example: 0.86, description: 'Customer concentration, 1 − HHI.' })
  C: number;

  @ApiProperty({ example: 0.9, description: 'Revenue volatility.' })
  V: number;

  @ApiProperty({ example: 0.95, description: 'Revenue diversity.' })
  D: number;

  @ApiProperty({ example: 0.88, description: 'Operating capacity.' })
  M: number;

  @ApiProperty({ example: 1.1, description: 'Revenue growth. May exceed 1.' })
  G: number;
}

export class HealthMetricsDto {
  @ApiProperty({ example: 0.98, description: 'Routed revenue over expected revenue.' })
  coverageRatio: number;

  @ApiProperty({ example: 99.4 })
  uptimePct: number;

  @ApiProperty({ example: 96.2 })
  successPct: number;

  @ApiProperty({ example: 0.9 })
  refundRatePct: number;

  @ApiProperty({ example: 184 })
  latencyMs: number;

  @ApiProperty({ example: true, description: 'Advertised payTo still matches the deployed router.' })
  bindingOk: boolean;

  @ApiProperty({ example: true })
  endpointUp: boolean;

  @ApiProperty({ type: QualityFactorsDto })
  factors: QualityFactorsDto;
}

export class VaultStateDto {
  @ApiProperty({ example: 25000 })
  totalAssets: number;

  @ApiProperty({ example: 16530 })
  availableLiquidity: number;

  @ApiProperty({ example: 412.6 })
  protocolReserve: number;

  @ApiProperty({ example: 2500, description: 'Absorbs defaults ahead of liquidity providers.' })
  firstLossTranche: number;

  @ApiProperty({ example: 0, description: 'Total sitting in the FIFO exit queue.' })
  queueTotal: number;

  @ApiProperty({ example: 0 })
  realizedLosses: number;

  @ApiProperty({ example: 7 })
  activeBorrowers: number;

  @ApiProperty({ example: 1 })
  onWatch: number;

  @ApiProperty({ example: 41280 })
  routedRevenue30d: number;

  @ApiProperty({ example: 6190 })
  principalRepaid: number;

  @ApiProperty({ example: 184.2 })
  interestGenerated: number;

  @ApiProperty({ example: 1.007597, description: 'Value of one vault share, USDC.' })
  sharePrice: number;
}

export class LpPositionDto {
  @ApiProperty({ example: '0x8e11…4c73' })
  address: string;

  @ApiProperty({ example: 12400 })
  walletBalance: number;

  @ApiProperty({ example: 5000 })
  supplied: number;

  @ApiProperty({ example: 4962.31 })
  shares: number;

  @ApiProperty({ example: 0 })
  queued: number;

  @ApiProperty({ example: 0, description: 'Part of the queued amount already funded.' })
  queueFunded: number;
}

export class ActivityEventDto {
  @ApiProperty({ example: '14:31:02', description: 'UTC time of day.' })
  time: string;

  @ApiProperty({ example: 'credit.repayment.completed' })
  type: string;

  @ApiProperty({ example: '0x9c4e…a7f1', description: 'Actor handle. Never a payer address.' })
  who: string;

  @ApiProperty({ example: '90.00 USDC', description: 'Pre-formatted, including the unit.' })
  amount: string;

  @ApiProperty({ example: '0x4a71…9f30' })
  tx: string;

  @ApiPropertyOptional({ example: 'interest 0.24 · principal 89.76' })
  note?: string;
}

export class AlertDto {
  @ApiProperty({ example: '12:47' })
  time: string;

  @ApiProperty({ example: '✓' })
  icon: string;

  @ApiProperty({ example: 'Draw completed' })
  title: string;

  @ApiPropertyOptional({ example: '400.00 USDC to 0x2b18…9e04' })
  body?: string;

  @ApiProperty({ example: true })
  unread: boolean;

  @ApiPropertyOptional({ example: '0x4a71…9f30' })
  tx?: string;

  @ApiPropertyOptional({ example: '/custody' })
  href?: string;

  @ApiPropertyOptional({ example: 'Re-verify' })
  cta?: string;
}

export class SnapshotMetaDto {
  @ApiProperty({ example: 60, description: 'Settlement days processed.' })
  day: number;

  @ApiProperty({ example: 'Arc Testnet' })
  network: string;

  @ApiProperty({ example: '2026-08-02T14:31:07.000Z', format: 'date-time' })
  asOf: string;
}

/** Everything the surfaces read. One request, one consistent moment in time. */
export class ProtocolSnapshotDto {
  @ApiProperty({ type: BorrowerPositionDto })
  borrower: BorrowerPositionDto;

  @ApiProperty({ type: RevenueMetricsDto })
  revenue: RevenueMetricsDto;

  @ApiProperty({ type: HealthMetricsDto })
  health: HealthMetricsDto;

  @ApiProperty({ type: VaultStateDto })
  vault: VaultStateDto;

  @ApiProperty({ type: LpPositionDto })
  lp: LpPositionDto;

  @ApiProperty({ type: [ActivityEventDto] })
  events: ActivityEventDto[];

  @ApiProperty({ type: [AlertDto] })
  alerts: AlertDto[];

  @ApiProperty({ type: SnapshotMetaDto })
  meta: SnapshotMetaDto;
}
