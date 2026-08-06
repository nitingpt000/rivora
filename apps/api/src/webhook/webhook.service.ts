import { createHash, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isPrivateAddress } from '../common/private-address';
import { LedgerError } from '../common/ledger.error';
import { PrismaService } from '../prisma/prisma.service';
import type {
  WebhookCreatedDto,
  WebhookListDto,
  WebhookSubscriptionDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from './webhook.dto';

/**
 * Webhook subscription management.
 *
 * The secret is returned exactly once, at creation, and stored as issued —
 * the receiver needs the same bytes to verify signatures, so unlike a
 * password it cannot be hashed. What limits the blast radius of a leaked
 * database is that a secret signs deliveries and authorizes nothing.
 */
@Injectable()
export class WebhookService {
  private readonly allowPrivate: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.allowPrivate = config.get<boolean>('webhookAllowPrivate') ?? false;
  }

  async create(input: CreateWebhookDto): Promise<WebhookCreatedDto> {
    await this.validateTarget(input.url);

    const secret = `whsec_${randomBytes(32).toString('hex')}`;
    const subscription = await this.prisma.webhookSubscription.create({
      data: { url: input.url, events: [...new Set(input.events)], secret },
    });

    return { ...this.view(subscription), secret };
  }

  async list(): Promise<WebhookListDto> {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { deliveries: { where: { status: 'pending' } } } },
      },
    });

    const failed = await this.prisma.webhookDelivery.groupBy({
      by: ['subscriptionId'],
      where: { status: 'exhausted' },
      _count: true,
    });
    const failedBySubscription = new Map(failed.map((row) => [row.subscriptionId, row._count]));

    return {
      subscriptions: subscriptions.map((subscription) => ({
        ...this.view(subscription),
        pendingDeliveries: subscription._count.deliveries,
        exhaustedDeliveries: failedBySubscription.get(subscription.id) ?? 0,
      })),
    };
  }

  async update(id: string, input: UpdateWebhookDto): Promise<WebhookSubscriptionDto> {
    await this.mustExist(id);
    if (input.url !== undefined) await this.validateTarget(input.url);

    const subscription = await this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.events !== undefined ? { events: [...new Set(input.events)] } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    return this.view(subscription);
  }

  async remove(id: string): Promise<void> {
    await this.mustExist(id);
    // Cascades to the delivery history. The events themselves stay — they
    // describe what the protocol did, not who was listening.
    await this.prisma.webhookSubscription.delete({ where: { id } });
  }

  /**
   * The same refusals delivery applies, applied where the operator can see
   * them. Passing here is necessary, not sufficient — DNS can change, so
   * delivery re-checks every time.
   */
  private async validateTarget(target: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new LedgerError(`"${target}" is not a URL.`, 'invalid_webhook_url');
    }

    if (this.allowPrivate) return;

    if (url.protocol !== 'https:') {
      throw new LedgerError('Webhook targets must be HTTPS.', 'invalid_webhook_url');
    }

    let address: string;
    try {
      address = (await lookup(url.hostname)).address;
    } catch {
      throw new LedgerError(`${url.hostname} does not resolve.`, 'invalid_webhook_url');
    }
    if (isPrivateAddress(address)) {
      throw new LedgerError(
        `${url.hostname} resolves to ${address}, a private address.`,
        'invalid_webhook_url',
      );
    }
  }

  private async mustExist(id: string): Promise<void> {
    const found = await this.prisma.webhookSubscription.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException({
        error: `No webhook subscription "${id}".`,
        code: 'webhook_not_found',
        statusCode: 404,
      });
    }
  }

  private view(subscription: {
    id: string;
    url: string;
    events: string[];
    secret: string;
    active: boolean;
    createdAt: Date;
  }): WebhookSubscriptionDto {
    return {
      id: subscription.id,
      url: subscription.url,
      events: subscription.events,
      // Enough to tell two secrets apart in a console, never enough to sign.
      secretFingerprint: createHash('sha256')
        .update(subscription.secret)
        .digest('hex')
        .slice(0, 8),
      active: subscription.active,
      createdAt: subscription.createdAt.toISOString(),
    };
  }
}
