import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuditService } from '../audit/audit.service';
import type { SessionUserDto } from '../auth/auth.dto';
import { CurrentUser, RequestId, Roles } from '../auth/auth.decorators';
import { ApiErrorDto } from '../contracts/operations.dto';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookCreatedDto,
  WebhookListDto,
  WebhookSubscriptionDto,
} from './webhook.dto';
import { WebhookService } from './webhook.service';

/**
 * Webhook subscription management. PRD §27.
 *
 * Operator-only: a delivery target sees protocol events as they commit,
 * which is the same visibility the risk console has. Every mutation is
 * audited — a subscription is standing configuration that outlives the
 * session that created it, and who pointed the protocol's event stream at
 * which address has to be answerable later.
 */
@ApiTags('webhooks')
@ApiBearerAuth('bearer')
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'This wallet is not an operator.' })
@Roles('ops')
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly webhooks: WebhookService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register a webhook subscription',
    description:
      'The signing secret is returned once, here, and never again. Targets must be HTTPS on a public address; the same check runs again before every delivery.',
  })
  @ApiOkResponse({ type: WebhookCreatedDto })
  async create(
    @Body() body: CreateWebhookDto,
    @CurrentUser() user: SessionUserDto,
    @RequestId() requestId: string,
    @Req() request: Request,
  ): Promise<WebhookCreatedDto> {
    const created = await this.webhooks.create(body);
    await this.audit.record({
      actor: user.address,
      role: 'ops',
      action: 'webhook.subscription.created',
      subject: created.id,
      requestId,
      ip: request.ip,
      metadata: { url: body.url, events: body.events },
    });
    return created;
  }

  @Get()
  @ApiOperation({
    summary: 'Every subscription, with its delivery backlog',
    description:
      'Secrets are reported as fingerprints only. `exhaustedDeliveries` counting up is a receiver that has stopped answering.',
  })
  @ApiOkResponse({ type: WebhookListDto })
  list(): Promise<WebhookListDto> {
    return this.webhooks.list();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a subscription’s target, events or status' })
  @ApiOkResponse({ type: WebhookSubscriptionDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWebhookDto,
    @CurrentUser() user: SessionUserDto,
    @RequestId() requestId: string,
    @Req() request: Request,
  ): Promise<WebhookSubscriptionDto> {
    const updated = await this.webhooks.update(id, body);
    await this.audit.record({
      actor: user.address,
      role: 'ops',
      action: 'webhook.subscription.updated',
      subject: id,
      requestId,
      ip: request.ip,
      metadata: { ...body },
    });
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a subscription',
    description: 'Removes the subscription and its delivery history. The events themselves stay.',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: SessionUserDto,
    @RequestId() requestId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.webhooks.remove(id);
    await this.audit.record({
      actor: user.address,
      role: 'ops',
      action: 'webhook.subscription.deleted',
      subject: id,
      requestId,
      ip: request.ip,
    });
  }
}
