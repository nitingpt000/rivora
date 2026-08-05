import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';

export class ReserveEventDto {
  @ApiProperty({ format: 'date-time' })
  at: string;

  @ApiProperty({ enum: ['contribution', 'applied', 'released', 'topup'] })
  type: string;

  @ApiProperty({ example: 9, description: 'Signed. Negative when the reserve is drawn down.' })
  amount: number;

  @ApiProperty({ example: 248.6, description: 'Reserve balance after the event.' })
  balance: number;

  @ApiPropertyOptional({ example: '0x4a71…9f30' })
  tx?: string;

  @ApiPropertyOptional()
  note?: string;
}

export class ScoreComponentDto {
  @ApiProperty({ example: 'reliability' })
  key: string;

  @ApiProperty({ example: 'Service reliability' })
  label: string;

  @ApiProperty({ example: 0.2, description: 'Share of the total score this signal can carry.' })
  weight: number;

  @ApiProperty({ example: 0.927, description: 'Normalised signal strength, 0–1.' })
  value: number;

  @ApiProperty({ example: 18.54, description: 'Points contributed to the 0–100 score.' })
  contribution: number;
}

export class ObservationRequirementDto {
  @ApiProperty({ example: '30 days of revenue history' })
  label: string;

  @ApiProperty({ example: 0.7, description: 'Progress toward the threshold, 0–1.' })
  ratio: number;

  @ApiProperty({ example: '21 / 30', description: 'Progress in the requirement’s own units.' })
  progress: string;

  @ApiProperty({ enum: ['pass', 'pending'] })
  status: string;
}

export class ObservationStatusDto {
  @ApiProperty({ example: 21 })
  daysObserved: number;

  @ApiProperty({ example: 30 })
  daysRequired: number;

  @ApiProperty({ type: [ObservationRequirementDto] })
  requirements: ObservationRequirementDto[];

  @ApiProperty({ example: false, description: 'True once every requirement passes.' })
  eligible: boolean;

  @ApiProperty({
    type: [Number],
    description: 'Settled revenue per day so far, oldest first.',
  })
  dailySeries: number[];
}

/**
 * The borrower's own registration details.
 *
 * Separate from the position: this is what the operator entered and what the
 * protocol bound, and it changes on registration rather than on settlement.
 */
export class BorrowerProfileDto {
  @ApiProperty({ example: '0x9c4e…a7f1' })
  handle: string;

  @ApiProperty({ example: 'Quote Feed API' })
  serviceName: string;

  @ApiProperty({ example: 'Data lookup and static datasets' })
  category: string;

  @ApiProperty({ example: 'https://api.example.com/v1/quotes' })
  endpoint: string;

  @ApiPropertyOptional({ example: '0x4b21…9d07' })
  endpointHash?: string;

  @ApiPropertyOptional({ example: '0x7d10…3c88', description: 'Bound Revenue Router.' })
  routerAddress?: string;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  custody: string;

  @ApiProperty({ example: '0x2b18…9e04' })
  operatingWallet: string;

  @ApiProperty({ example: '0x5d92…4f11' })
  ownerWallet: string;

  @ApiPropertyOptional({ example: 'Ridgeline Data Ltd' })
  operator?: string;

  @ApiPropertyOptional({ example: 'Estonia' })
  jurisdiction?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  kybVerifiedAt?: string;

  @ApiProperty({ format: 'date-time' })
  registeredAt: string;
}

export class RevenueCustomerDto {
  @ApiProperty({
    example: 'payer-01',
    description: 'Stable pseudonym. Payer addresses are never returned.',
  })
  label: string;

  @ApiProperty({ example: 1890 })
  revenue30d: number;

  @ApiProperty({ example: 14 })
  sharePct: number;

  @ApiProperty({ example: 4210 })
  requests30d: number;

  @ApiProperty({ example: '2026-06-12T00:00:00.000Z', format: 'date-time' })
  firstSeenAt: string;
}

export class ExcludedRevenueDto {
  @ApiProperty({ type: [RevenueCustomerDto] })
  payers: RevenueCustomerDto[];

  @ApiProperty({ example: 540, description: 'Total excluded from the eligible figure, USDC.' })
  total: number;

  @ApiProperty({
    example: { 'Payer age below 7 days': 320, 'Refunded within window': 220 },
    description: 'Excluded amount by reason.',
  })
  byReason: Record<string, number>;
}

export class RevenueDetailDto {
  @ApiProperty({ example: 13500 })
  eligible: number;

  @ApiProperty({ example: 14040 })
  gross: number;

  @ApiProperty({ example: 540 })
  excluded: number;

  @ApiProperty({ example: 450 })
  dailyMean: number;

  @ApiProperty({ example: 35 })
  growthPct: number;

  @ApiProperty({ example: 14 })
  largestPayerPct: number;

  @ApiProperty({ example: 0.14 })
  hhi: number;

  @ApiProperty({ enum: ['LOW', 'MODERATE', 'ELEVATED', 'HIGH'], example: 'MODERATE' })
  concentrationBand: string;

  @ApiProperty({ example: 386 })
  uniquePayers: number;

  @ApiProperty({ example: 168 })
  repeatPayers: number;

  @ApiProperty({ example: 43.5 })
  repeatRatePct: number;

  @ApiPropertyOptional({ example: '2026-07-03T00:00:00.000Z', format: 'date-time' })
  windowStart?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', format: 'date-time' })
  windowEnd?: string;

  @ApiProperty({
    type: [Number],
    example: [42, 55, 48, 61],
    description:
      'Settled revenue per day over the window, oldest first. The consistency signal is computed from this, not from the mean.',
  })
  dailySeries: number[];

  @ApiProperty({ example: 412000, description: 'Paid requests authorized over the window.' })
  requests: number;

  @ApiProperty({ example: 396500, description: 'Authorizations that settled successfully.' })
  settled: number;

  @ApiProperty({ example: 12100 })
  failed: number;

  @ApiProperty({ example: 3400 })
  refunded: number;

  @ApiProperty({ example: 0.034, description: 'Mean price per settled request, USDC.' })
  meanPrice: number;

  @ApiProperty({ example: 74, description: 'Payers first seen inside the window.' })
  newPayers: number;

  @ApiProperty({ example: 41, description: 'Median days between a payer’s first and last request.' })
  medianPayerLifetimeDays: number;
}

export class UpstreamDependencyDto {
  @ApiProperty({ example: 'Model provider A' })
  name: string;

  @ApiProperty({ example: 'compute' })
  category: string;

  @ApiProperty({ example: 62, description: 'Share of the borrower’s declared cost base.' })
  declaredCostPct: number;

  @ApiProperty({ example: 58.2, description: 'Share of protocol principal exposed through it.' })
  sharePct: number;

  @ApiProperty({ example: true, description: 'Whether an equivalent provider could be swapped in.' })
  substitutable: boolean;
}

export class CustodyStatusDto {
  @ApiProperty({ enum: ['A', 'B', 'C'], example: 'A' })
  model: string;

  @ApiProperty({ example: true, description: 'Advertised payTo matches the deployed router.' })
  bindingOk: boolean;

  @ApiProperty({ example: true })
  endpointUp: boolean;

  @ApiProperty({ example: '0x7f3a…c1d2', nullable: true })
  routerAddress: string | null;

  @ApiProperty({ example: '0x3b7d…e922', nullable: true })
  endpointHash: string | null;

  @ApiProperty({ example: 0.98, description: 'Routed revenue over expected revenue.' })
  coverageRatio: number;

  @ApiProperty({ enum: ['HEALTHY', 'DRIFTING', 'BROKEN'], example: 'HEALTHY' })
  coverageState: string;

  @ApiProperty({ example: 99.4 })
  uptimePct: number;

  @ApiProperty({ example: 20, description: 'Percent of settled revenue routed to repayment.' })
  repaymentSharePct: number;

  @ApiProperty({ example: 2 })
  reserveSharePct: number;

  @ApiProperty({ example: 78 })
  operatingSharePct: number;

  @ApiProperty({
    type: [UpstreamDependencyDto],
    description: 'Services the borrower depends on to fulfil requests.',
  })
  upstream: UpstreamDependencyDto[];
}

export class AllowlistEntryDto {
  @ApiProperty({ example: '0xf120…88ab' })
  address: string;

  @ApiProperty({ example: 'Model provider A' })
  name: string;

  @ApiProperty({ example: 'compute' })
  category: string;

  @ApiPropertyOptional({ format: 'date-time' })
  lastUsedAt?: string;
}

export class PolicyDecisionDto {
  @ApiProperty({ format: 'date-time' })
  at: string;

  @ApiProperty({ example: '0xf120…88ab' })
  recipient: string;

  @ApiProperty({ example: 42 })
  amount: number;

  @ApiProperty({ example: 'compute' })
  category: string;

  @ApiProperty({ enum: ['allowed', 'rejected', 'queued'] })
  outcome: string;

  @ApiProperty({ example: 'above 250 · awaiting owner signature' })
  reason: string;
}

export class AgentPolicyDto {
  @ApiProperty({ example: 100, description: 'Largest single payment the agent may make, USDC.' })
  maxPayment: number;

  @ApiProperty({ example: 500 })
  maxDaily: number;

  @ApiProperty({ example: 182.4 })
  spentToday: number;

  @ApiProperty({ example: 250, description: 'Above this, an owner-wallet signature is required.' })
  humanApprovalThreshold: number;

  @ApiProperty({ example: ['compute', 'data', 'storage'] })
  allowedCategories: string[];

  @ApiProperty({ example: ['marketing', 'payroll'] })
  blockedCategories: string[];

  @ApiProperty({
    example: 24,
    description:
      'Delay before a change takes effect, so a compromised agent cannot widen its own limits and drain the line.',
  })
  policyChangeDelayHours: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'When the pending change applies.' })
  pendingChangeAt?: string;

  @ApiProperty({
    type: [AllowlistEntryDto],
    description: 'Destinations a draw may be spent to. Anything else is refused.',
  })
  allowlist: AllowlistEntryDto[];

  @ApiProperty({
    type: [PolicyDecisionDto],
    description: 'Recent evaluations, newest first. Rejections are recorded as well as approvals.',
  })
  decisions: PolicyDecisionDto[];
}

export class UpdatePolicyDto {
  @ApiPropertyOptional({ example: 150, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1_000_000)
  maxPayment?: number;

  @ApiPropertyOptional({ example: 750, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(10_000_000)
  maxDaily?: number;

  @ApiPropertyOptional({ example: 300, minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1_000_000)
  humanApprovalThreshold?: number;

  @ApiPropertyOptional({ example: ['compute', 'data'], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  allowedCategories?: string[];

  @ApiPropertyOptional({ example: ['marketing'], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  blockedCategories?: string[];
}

export class ReserveStatusDto {
  @ApiProperty({ example: 248.6 })
  balance: number;

  @ApiProperty({ example: 253 })
  target: number;

  @ApiProperty({ example: 98.3 })
  coveragePct: number;

  @ApiProperty({ example: 2, description: 'Percent of settled revenue routed to the reserve.' })
  contributionSharePct: number;

  @ApiProperty({ example: 9, description: 'Expected daily contribution at current revenue, USDC.' })
  dailyContribution: number;

  @ApiProperty({ type: [ReserveEventDto], description: 'Movements, newest first.' })
  activity: ReserveEventDto[];
}

export class ConstraintDto {
  @ApiProperty({ example: 'growthCap' })
  key: string;

  @ApiProperty({ example: 'Growth cap' })
  label: string;

  @ApiProperty({ example: '1,690.00 × 1.5', description: 'The arithmetic, rendered for the borrower.' })
  formula: string;

  @ApiProperty({ example: 2535 })
  value: number;

  @ApiProperty({ example: true, description: 'True for the rung that determined the limit.' })
  binding: boolean;

  @ApiPropertyOptional({ example: false })
  nearBinding?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Shown for context; does not constrain.' })
  advisory?: boolean;
}

export class FactorPenaltyDto {
  @ApiProperty({ example: 'C' })
  symbol: string;

  @ApiProperty({ example: 'Customer concentration' })
  label: string;

  @ApiProperty({ example: 0.86 })
  value: number;

  @ApiProperty({ example: 0.2 })
  weight: number;

  @ApiProperty({ example: 2.8, description: 'Contribution to the haircut, percentage points.' })
  points: number;
}

export class AssessmentDto {
  @ApiProperty({ example: 78 })
  score: number;

  @ApiProperty({ example: 'Strong' })
  tier: string;

  @ApiProperty({ example: 2530 })
  limit: number;

  @ApiProperty({ example: 1690 })
  previousLimit: number;

  @ApiProperty({ example: 'growthCap', description: 'Which rung decided the limit.' })
  bindingKey: string;

  @ApiPropertyOptional({
    example:
      'Your limit is held at 2,530 USDC by the growth cap rather than by your revenue…',
    description:
      'Plain-language reading of the ladder, written after the decision was made. Absent when unconfigured or when the call failed — the ladder below is the record and does not depend on it.',
  })
  explanation?: string;

  @ApiProperty({ type: [ConstraintDto], description: 'Every candidate limit, in display order.' })
  ladder: ConstraintDto[];

  @ApiProperty({ type: [FactorPenaltyDto] })
  penalties: FactorPenaltyDto[];

  @ApiProperty({ example: 0.79, description: 'Composite quality factor.' })
  quality: number;

  @ApiProperty({ example: 'riv-uw-2.1' })
  model: string;

  @ApiProperty({ example: '2026-08-02T14:00:00.000Z', format: 'date-time' })
  assessedAt: string;

  @ApiProperty({
    type: [ScoreComponentDto],
    description: 'The weighted signals behind the score, in weight order.',
  })
  components: ScoreComponentDto[];
}

export class AssessmentHistoryEntryDto {
  @ApiProperty({ format: 'date-time' })
  at: string;

  @ApiProperty({ example: 78 })
  score: number;

  @ApiProperty({ example: 'Strong' })
  tier: string;

  @ApiProperty({ example: 2530 })
  limit: number;

  @ApiProperty({ example: 1690 })
  previousLimit: number;

  @ApiProperty({ example: 'growthCap' })
  bindingKey: string;
}

export class NotificationDto {
  @ApiProperty({ example: 'clx8f2k9a0000' })
  id: string;

  @ApiProperty({ format: 'date-time' })
  at: string;

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

export class RegisterServiceDto {
  @ApiProperty({ example: 'QuoteStream Market Data API', maxLength: 120 })
  @IsString()
  @Length(2, 120)
  serviceName: string;

  @ApiProperty({ example: 'Data lookup and static datasets' })
  @IsIn([
    'Text generation and inference proxy',
    'Embedding and vector services',
    'Search, retrieval and enrichment',
    'Document and media processing',
    'Data lookup and static datasets',
  ])
  category: string;

  @ApiProperty({ example: 'https://api.quotestream.dev/v1' })
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    // Plain http would let anyone on the path observe or alter the 402
    // challenge the underwriter reads.
    { message: 'endpoint must be an https URL' },
  )
  @Length(8, 500)
  endpoint: string;

  @ApiPropertyOptional({ enum: ['A', 'B', 'C'], example: 'A' })
  @IsOptional()
  @IsIn(['A', 'B', 'C'])
  custody?: string;

  @ApiPropertyOptional({ example: 'QuoteStream Labs Ltd', maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  operator?: string;

  @ApiPropertyOptional({ example: 'Singapore', maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  jurisdiction?: string;

  @ApiPropertyOptional({ example: 0.04, description: 'Advertised price per request, USDC.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  pricePerRequest?: number;
}

export class VerifyEndpointDto {
  @ApiProperty({ example: 'https://api.quotestream.dev/v1' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Length(8, 500)
  endpoint: string;
}

export class ProbeLineDto {
  @ApiProperty({ example: 'GET /v1/quote (unpaid) → 402 Payment Required' })
  text: string;

  @ApiProperty({ enum: ['✓', '⚠', '✕', ''], example: '✓' })
  mark: string;
}

export class EndpointVerificationDto {
  @ApiProperty({ example: true })
  verified: boolean;

  @ApiProperty({ example: true, description: 'Advertised payTo matches the deployed router.' })
  bindingOk: boolean;

  @ApiProperty({ type: [ProbeLineDto], description: 'The probe log, in order.' })
  log: ProbeLineDto[];

  @ApiPropertyOptional({ example: '0x3b7d…e922', description: 'Written onchain once bound.' })
  endpointHash?: string;
}

export class ServiceRegistrationDto {
  @ApiProperty({ example: 'clx8f2k9a0000' })
  id: string;

  @ApiProperty({ example: '0x9c4e…a7f1' })
  handle: string;

  @ApiProperty({ example: 'QuoteStream Market Data API' })
  serviceName: string;

  @ApiProperty({ enum: ['OBSERVATION'], example: 'OBSERVATION' })
  status: string;

  @ApiProperty({ example: 30, description: 'Days of observation before the first assessment.' })
  observationDays: number;

  @ApiProperty({ format: 'date-time' })
  registeredAt: string;
}

/** Re-exported so borrower routes and risk routes share one query shape. */
export { PaginationQueryDto } from '../contracts/operations.dto';
