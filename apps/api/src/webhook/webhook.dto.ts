import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

import { WEBHOOK_EVENTS } from './webhook.events';

export class CreateWebhookDto {
  @ApiProperty({
    example: 'https://ops.example.com/hooks/rivora',
    description: 'Delivery target. HTTPS with a public address; validated again at every delivery.',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2_000)
  url!: string;

  @ApiProperty({
    example: ['credit.draw.completed', 'borrower.defaulted'],
    description: 'Event types to receive, from the PRD §27 catalogue.',
    isArray: true,
    enum: WEBHOOK_EVENTS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WEBHOOK_EVENTS.length)
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];
}

export class UpdateWebhookDto {
  @ApiPropertyOptional({ example: 'https://ops.example.com/hooks/rivora' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2_000)
  url?: string;

  @ApiPropertyOptional({ isArray: true, enum: WEBHOOK_EVENTS })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WEBHOOK_EVENTS.length)
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events?: string[];

  @ApiPropertyOptional({ example: false, description: 'A disabled subscription receives nothing and its queue exhausts.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class WebhookSubscriptionDto {
  @ApiProperty({ example: 'cmb1x…' })
  id!: string;

  @ApiProperty({ example: 'https://ops.example.com/hooks/rivora' })
  url!: string;

  @ApiProperty({ isArray: true, enum: WEBHOOK_EVENTS })
  events!: string[];

  @ApiProperty({
    example: '9f2c11ab',
    description: 'First bytes of the secret’s SHA-256 — enough to tell two secrets apart, never enough to sign.',
  })
  secretFingerprint!: string;

  @ApiProperty({ example: true })
  active!: boolean;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  createdAt!: string;
}

export class WebhookCreatedDto extends WebhookSubscriptionDto {
  @ApiProperty({
    example: 'whsec_4f1c…',
    description: 'HMAC-SHA256 signing key. Shown once, at creation, and never again.',
  })
  secret!: string;
}

export class WebhookSubscriptionSummaryDto extends WebhookSubscriptionDto {
  @ApiProperty({ example: 0, description: 'Deliveries waiting for the dispatcher.' })
  pendingDeliveries!: number;

  @ApiProperty({ example: 0, description: 'Deliveries dropped after every attempt failed.' })
  exhaustedDeliveries!: number;
}

export class WebhookListDto {
  @ApiProperty({ type: [WebhookSubscriptionSummaryDto] })
  subscriptions!: WebhookSubscriptionSummaryDto[];
}
