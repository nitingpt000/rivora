import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsString, Length, Min } from 'class-validator';

import { ScoreComponentDto } from '../borrower/borrower.dto';

export class WatchlistEntryDto {
  @ApiProperty({ example: '0x4c30…f18b' })
  handle: string;

  @ApiProperty({ enum: ['ACTIVE', 'WATCH', 'RESTRICTED', 'DELINQUENT', 'DEFAULTED'] })
  status: string;

  @ApiProperty({ example: 58 })
  score: number;

  @ApiProperty({ example: -4, description: 'Change since the previous assessment.' })
  scoreDelta: number;

  @ApiProperty({ example: 'Standard' })
  tier: string;

  @ApiProperty({ example: 1250 })
  principal: number;

  @ApiProperty({ example: 0.71 })
  coverageRatio: number;

  @ApiProperty({ example: 'coverage ratio 0.71', description: 'Why it is on the list.' })
  trigger: string;
}

export class ExposureBucketDto {
  @ApiProperty({ example: 'Strong' })
  tier: string;

  @ApiProperty({ example: 3 })
  borrowers: number;

  @ApiProperty({ example: 3970 })
  principal: number;

  @ApiProperty({ example: 46.9, description: 'Share of outstanding principal.' })
  sharePct: number;
}

export class SectorExposureDto {
  @ApiProperty({ example: 'Data lookup and static datasets' })
  sector: string;

  @ApiProperty({ example: 3940 })
  principal: number;

  @ApiProperty({ example: 46.5 })
  sharePct: number;

  @ApiProperty({ example: 40, description: 'Share above which new draws are blocked.' })
  capPct: number;

  @ApiProperty({ example: true })
  breached: boolean;
}

export class UpstreamExposureDto {
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

export class RiskAlertDto {
  @ApiProperty({ enum: ['restrict', 'warn', 'info'] })
  severity: string;

  @ApiProperty({ example: '0x9c4e…a7f1', description: 'Borrower handle, or `Sector`.' })
  who: string;

  @ApiProperty({ example: 'Coverage ratio 0.71 — probable partial diversion' })
  text: string;

  @ApiProperty({ example: 'WATCH · principal 840.00' })
  meta: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'When the condition was observed.' })
  at?: string;

  @ApiProperty({ example: '/risk/borrower?handle=0x9c4e…a7f1' })
  href: string;

  @ApiProperty({ example: 'Review' })
  cta: string;
}

export class AnomalyEvidenceDto {
  @ApiProperty({ example: 'Payer 0x31aa…7c02 funded from operating wallet' })
  finding: string;

  @ApiProperty({ example: 'Jul 22 09:14 UTC' })
  at: string;

  @ApiProperty({ example: '120.00 USDC' })
  detail: string;

  @ApiPropertyOptional({ example: '0x4a71…9f30' })
  tx?: string;
}

export class AnomalyWalletDto {
  @ApiProperty({ example: '0x31aa…7c02' })
  address: string;

  @ApiProperty({ example: 'Jul 22' })
  fundedOn: string;

  @ApiProperty({ example: 120 })
  amount: number;
}

export class AnomalyAfterStateDto {
  @ApiProperty({ example: 11100 })
  eligibleRevenue: number;

  @ApiProperty({ example: 57 })
  score: number;

  @ApiProperty({ example: 'Restricted' })
  tier: string;

  @ApiProperty({ example: 0 })
  limit: number;

  @ApiProperty({ example: 3500 })
  repaymentBps: number;
}

export class AnomalyDetailDto {
  @ApiProperty({ example: 'A-0142' })
  reference: string;

  @ApiProperty({ example: '0x9c4e…a7f1' })
  borrower: string;

  @ApiProperty({ example: 'Circular funding' })
  kind: string;

  @ApiProperty({ format: 'date-time' })
  detectedAt: string;

  @ApiProperty({ example: 2400, description: 'Revenue removed from the eligible base.' })
  washAmount: number;

  @ApiProperty({ example: 3 })
  payerCount: number;

  @ApiProperty({ example: 9 })
  daysSpanned: number;

  @ApiProperty({
    example: -68,
    description: 'Revenue net of the gas and fees spent generating it. Negative proves the activity was not economic.',
  })
  netEconomicRevenue: number;

  @ApiProperty({ example: '0x8b41…c07e' })
  evidenceHash: string;

  @ApiProperty({ example: '0x0d31…44a9' })
  txHash: string;

  @ApiProperty({ type: [AnomalyEvidenceDto] })
  evidence: AnomalyEvidenceDto[];

  @ApiProperty({ type: [AnomalyWalletDto] })
  fundedWallets: AnomalyWalletDto[];

  @ApiProperty({ type: AnomalyAfterStateDto, description: 'Borrower state after the write-back.' })
  after: AnomalyAfterStateDto;
}

/**
 * A limit the underwriter would set today, against the one currently in force.
 *
 * Assessments run on a schedule; this is what the ladder says right now. The
 * gap between the two is the operator's queue.
 */
export class LimitRecommendationDto {
  @ApiProperty({ example: '0x9c4e…a7f1' })
  handle: string;

  @ApiProperty({ example: 2530, description: 'Limit currently in force.' })
  current: number;

  @ApiProperty({ example: 2100, description: 'Limit the ladder produces from live inputs.' })
  recommended: number;

  @ApiProperty({ example: 'growthCap', description: 'Which rung decided the recommendation.' })
  bindingKey: string;

  @ApiProperty({ example: 'Standard' })
  tier: string;

  @ApiProperty({ example: 'reduce', enum: ['raise', 'reduce', 'hold'] })
  direction: string;
}

export class RiskTimelineEntryDto {
  @ApiProperty({ format: 'date-time' })
  at: string;

  @ApiProperty({ example: 'Assessment #2 — score 68 → 78, limit 1,690 → 2,530' })
  text: string;

  @ApiPropertyOptional({ example: '0x39d5…8ca0' })
  tx?: string;
}

export class BorrowerFactorsDto {
  @ApiProperty({ example: 0.95 }) S: number;
  @ApiProperty({ example: 0.86 }) C: number;
  @ApiProperty({ example: 0.9 }) V: number;
  @ApiProperty({ example: 0.95 }) D: number;
  @ApiProperty({ example: 0.88 }) M: number;
  @ApiProperty({ example: 1.1 }) G: number;
}

/**
 * One borrower, as a risk operator sees them.
 *
 * Wider than the borrower's own view — exact factor values rather than bands —
 * and narrower than it in one respect: no payer identities. The operator needs
 * to judge the risk, not to know the customers.
 */
export class BorrowerRiskDetailDto {
  @ApiProperty({ example: '0x9c4e…a7f1' })
  handle: string;

  @ApiProperty({ example: 'Quote Feed API' })
  serviceName: string;

  @ApiPropertyOptional({ example: 'Ridgeline Data Ltd' })
  operator?: string;

  @ApiPropertyOptional({ example: 'Estonia' })
  jurisdiction?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  kybVerifiedAt?: string;

  @ApiProperty({ enum: ['A', 'B', 'C'] })
  custody: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 'Strong' })
  tier: string;

  @ApiProperty({ example: 78 })
  score: number;

  @ApiProperty({ example: 10, description: 'Change since the previous assessment.' })
  scoreDelta: number;

  @ApiProperty({ example: 2000 })
  principal: number;

  @ApiProperty({ example: 8.42 })
  accruedInterest: number;

  @ApiProperty({ example: 2530 })
  limit: number;

  @ApiProperty({ example: 248.6 })
  reserve: number;

  @ApiProperty({ example: 20 })
  repaymentSharePct: number;

  @ApiProperty({ example: 12.1 })
  ratePct: number;

  @ApiProperty({ example: 0.98 })
  coverageRatio: number;

  @ApiProperty({ example: 0.14 })
  hhi: number;

  @ApiProperty({ type: BorrowerFactorsDto, description: 'Exact values. Borrowers see bands.' })
  factors: BorrowerFactorsDto;

  @ApiProperty({ type: [ScoreComponentDto] })
  components: ScoreComponentDto[];

  @ApiProperty({ type: [RiskTimelineEntryDto], description: 'Newest first.' })
  timeline: RiskTimelineEntryDto[];
}

export class ExposureReportDto {
  @ApiProperty({ example: 8470 })
  outstandingPrincipal: number;

  @ApiProperty({ example: 25000 })
  vaultAssets: number;

  @ApiProperty({ example: 0.3388 })
  utilization: number;

  @ApiProperty({ type: [ExposureBucketDto] })
  byTier: ExposureBucketDto[];

  @ApiProperty({ example: 2400, description: 'Largest single-borrower exposure, USDC.' })
  largestExposure: number;

  @ApiProperty({ example: 9.6, description: 'Largest exposure as a share of vault assets.' })
  largestExposurePct: number;

  @ApiProperty({
    example: 10,
    description: 'Per-borrower cap as a share of vault assets. PRD §31.5.',
  })
  perBorrowerCapPct: number;

  @ApiProperty({ example: 40 })
  sectorCapPct: number;

  @ApiProperty({ type: [SectorExposureDto], description: 'Principal by service category.' })
  bySector: SectorExposureDto[];

  @ApiProperty({
    type: [UpstreamExposureDto],
    description:
      'Concentration measured across borrowers — two services reselling the same provider are one dependency.',
  })
  upstream: UpstreamExposureDto[];

  @ApiProperty({ example: 0, description: 'Borrowers currently above the cap.' })
  breaches: number;
}

export class RiskParameterDto {
  @ApiProperty({ example: 'repaymentBps' })
  key: string;

  @ApiProperty({ example: 'Repayment share' })
  label: string;

  @ApiProperty({ example: '2000 bps' })
  value: string;

  @ApiProperty({ example: 'Basis points of settled revenue routed to repayment.' })
  description: string;

  @ApiProperty({ example: 'PRD §12.2' })
  reference: string;
}

export class DeclareDefaultDto {
  @ApiProperty({ example: '0x4c30…f18b' })
  @IsString()
  @Length(3, 100)
  handle: string;

  @ApiProperty({ example: 1850, description: 'Principal being written down, USDC.' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  principal: number;

  @ApiProperty({
    example: 'coverage ratio 0.31',
    description: 'The condition that triggered the declaration.',
  })
  @IsString()
  @Length(3, 300)
  trigger: string;

  @ApiProperty({ example: '0x6d20…be15', description: 'Hash of the evidence bundle.' })
  @IsString()
  @Length(3, 200)
  evidenceHash: string;

  @ApiProperty({
    enum: ['automatic', 'operator'],
    example: 'operator',
    description: 'Whether the protocol declared it or a person did.',
  })
  @IsIn(['automatic', 'operator'])
  source: string;
}

/**
 * A declaration and where it stands in the quorum.
 *
 * Returned by propose, approve and the pending list alike, so an operator
 * reads the same shape at every step of the flow.
 */
export class DeclarationStatusDto {
  @ApiProperty({ example: 'clx8f2k9a0000' })
  id: string;

  @ApiProperty({ example: '0x4c30…f18b' })
  handle: string;

  @ApiProperty({ example: 1850 })
  principal: number;

  @ApiProperty({ example: 'coverage ratio 0.31' })
  trigger: string;

  @ApiProperty({ enum: ['pending', 'committed'] })
  status: string;

  @ApiProperty({
    type: [String],
    example: ['0x90f7…b906'],
    description: 'Operators who have signed. Distinct by construction.',
  })
  signatures: string[];

  @ApiProperty({ example: 2, description: 'Signatures required to commit.' })
  required: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiPropertyOptional({ format: 'date-time' })
  committedAt?: string;

  @ApiPropertyOptional({
    example: 'The record is permanent. It may be cured, but no interface path deletes it.',
  })
  notice?: string;
}

export class AuditEntryDto {
  @ApiProperty({ format: 'date-time' })
  at: string;

  @ApiProperty({ example: '0x4a7c…7e02' })
  actor: string;

  @ApiPropertyOptional({ enum: ['borrower', 'lp', 'ops', 'partner'] })
  role?: string;

  @ApiProperty({ example: 'risk.default.declared' })
  action: string;

  @ApiPropertyOptional({ example: '0x4c30…f18b' })
  subject?: string;

  @ApiPropertyOptional({ example: '5f2c1a9e-…' })
  requestId?: string;
}
