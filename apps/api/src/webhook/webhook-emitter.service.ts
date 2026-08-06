import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { WebhookEventType } from './webhook.events';

/**
 * The write side of webhook delivery — an outbox, not a dispatcher.
 *
 * `emit` runs inside the caller's transaction, so an event row exists if and
 * only if the domain change it reports committed. Delivery is someone else's
 * job (`WebhookDispatcherService`) and may fail, retry or exhaust without
 * ever touching what the protocol recorded.
 *
 * Fan-out happens here rather than at dispatch: each matching subscription
 * gets its delivery row in the same transaction. A subscription created
 * tomorrow therefore starts receiving events from tomorrow — it does not
 * inherit a backlog it never asked to observe — and an event with no
 * subscribers writes nothing at all, because an outbox nobody reads is just
 * a table that grows.
 */
@Injectable()
export class WebhookEmitter {
  async emit(
    tx: Prisma.TransactionClient,
    type: WebhookEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subscriptions = await tx.webhookSubscription.findMany({
      where: { active: true, events: { has: type } },
      select: { id: true },
    });
    if (subscriptions.length === 0) return;

    const event = await tx.webhookEvent.create({
      data: { type, payload: payload as Prisma.InputJsonObject },
      select: { id: true },
    });

    await tx.webhookDelivery.createMany({
      data: subscriptions.map((subscription) => ({
        eventId: event.id,
        subscriptionId: subscription.id,
      })),
    });
  }
}
