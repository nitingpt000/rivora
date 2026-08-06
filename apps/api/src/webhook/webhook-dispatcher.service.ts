import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';

import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isPrivateAddress } from '../common/private-address';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

/** Deliveries picked up per pass. A slow receiver delays its own queue, not the tick. */
const BATCH_SIZE = 25;

/** First retry delay; doubles per failure. Eight attempts span roughly two hours. */
const BACKOFF_BASE_MS = 30_000;

const EXHAUSTED_TITLE = 'Webhook deliveries exhausted';

/**
 * The read side of webhook delivery.
 *
 * Same lifecycle pattern as the chain indexer: an interval started at
 * bootstrap, a re-entrancy guard, and a `tick` that is public because the
 * timer is just one caller — the tests are another.
 *
 * ## The URL comes from an operator, and is still not trusted
 *
 * Registration validates the target, but DNS is not fixed: a hostname that
 * was public yesterday can resolve privately today. So the resolve-and-refuse
 * check runs again before every request leaves, and a target that has gone
 * private is exhausted rather than retried — retrying an SSRF attempt on a
 * schedule would be worse than making it once.
 *
 * ## Failure posture
 *
 * At-least-once. A delivery is marked before the receiver's side effects are
 * known, so a crash between the request and the write can deliver twice —
 * receivers deduplicate on the event id, which the envelope and the
 * `x-rivora-delivery` header both carry. Exhaustion after the final attempt
 * raises one ops alert per subscription, deduplicated the same way the
 * indexer's divergence alerts are.
 */
@Injectable()
export class WebhookDispatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  /** Local-stack escape hatch: the guard refuses every useful local receiver. */
  private readonly allowPrivate: boolean;

  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    config: ConfigService,
    @Optional() @Inject('WEBHOOK_FETCH') private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.intervalMs = config.get<number>('webhookDispatchIntervalMs') ?? 5_000;
    this.timeoutMs = config.get<number>('webhookTimeoutMs') ?? 5_000;
    this.maxAttempts = config.get<number>('webhookMaxAttempts') ?? 8;
    this.allowPrivate = config.get<boolean>('webhookAllowPrivate') ?? false;
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.safeTick(), this.intervalMs);
    this.logger.log(`dispatching webhooks every ${this.intervalMs}ms`);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.tick();
    } catch (cause) {
      // The next tick retries from the same queue state; a dispatch pass
      // failing must never take the process with it.
      this.logger.error(`dispatch pass failed: ${String(cause)}`);
    } finally {
      this.running = false;
    }
  }

  /** One dispatch pass. Public for the tests; the timer is just a caller. */
  async tick(): Promise<number> {
    const due = await this.prisma.webhookDelivery.findMany({
      where: { status: 'pending', nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: BATCH_SIZE,
      include: { event: true, subscription: true },
    });

    for (const delivery of due) {
      await this.deliver(delivery);
    }
    return due.length;
  }

  private async deliver(delivery: {
    id: string;
    attempts: number;
    event: { id: string; type: string; at: Date; payload: unknown };
    subscription: { id: string; url: string; secret: string; active: boolean };
  }): Promise<void> {
    if (!delivery.subscription.active) {
      await this.exhaust(delivery.id, delivery.subscription.id, 'subscription_disabled');
      return;
    }

    const refusal = await this.refuseTarget(delivery.subscription.url);
    if (refusal) {
      // A target that resolves privately is not a transient failure. Do not
      // retry it on a schedule.
      await this.exhaust(delivery.id, delivery.subscription.id, refusal);
      return;
    }

    const body = JSON.stringify({
      id: delivery.event.id,
      type: delivery.event.type,
      at: delivery.event.at.toISOString(),
      data: delivery.event.payload,
    });
    const signature = createHmac('sha256', delivery.subscription.secret)
      .update(body)
      .digest('hex');

    let failure: string | null = null;
    try {
      const response = await this.fetchImpl(delivery.subscription.url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'content-type': 'application/json',
          'x-rivora-event': delivery.event.type,
          'x-rivora-delivery': delivery.id,
          'x-rivora-signature': `sha256=${signature}`,
        },
        body,
      });
      if (response.status < 200 || response.status >= 300) {
        failure = `receiver answered ${response.status}`;
      }
    } catch (cause) {
      failure =
        cause instanceof Error && cause.name === 'TimeoutError'
          ? `timed out after ${this.timeoutMs / 1000}s`
          : `request failed: ${cause instanceof Error ? cause.message : String(cause)}`;
    }

    if (failure === null) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'delivered', attempts: delivery.attempts + 1, deliveredAt: new Date() },
      });
      return;
    }

    const attempts = delivery.attempts + 1;
    if (attempts >= this.maxAttempts) {
      await this.exhaust(delivery.id, delivery.subscription.id, failure, attempts);
      return;
    }

    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts,
        lastError: failure,
        nextAttemptAt: new Date(Date.now() + BACKOFF_BASE_MS * 2 ** (attempts - 1)),
      },
    });
  }

  /**
   * The registration-time checks, re-run at delivery time.
   *
   * Returns the reason to refuse, or null to proceed. `allowPrivate` waives
   * both the HTTPS requirement and the address check — it exists for the
   * local compose stack, where every reachable receiver is a private address.
   */
  private async refuseTarget(target: string): Promise<string | null> {
    if (this.allowPrivate) return null;

    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return 'target is not a URL';
    }
    if (url.protocol !== 'https:') return 'target is not HTTPS';

    let address: string;
    try {
      address = (await lookup(url.hostname)).address;
    } catch {
      return `${url.hostname} does not resolve`;
    }
    if (isPrivateAddress(address)) {
      return `${url.hostname} resolves to ${address}, a private address`;
    }
    return null;
  }

  /**
   * Ends a delivery permanently and tells an operator once.
   *
   * The alert is per subscription rather than per delivery — a dead receiver
   * exhausts everything queued behind it, and forty copies of the same fact
   * is how alerts get ignored.
   */
  private async exhaust(
    deliveryId: string,
    subscriptionId: string,
    reason: string,
    attempts?: number,
  ): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'exhausted', lastError: reason, ...(attempts ? { attempts } : {}) },
    });

    const alerted = await this.prisma.alert.findFirst({
      where: { title: EXHAUSTED_TITLE, body: { contains: subscriptionId } },
      select: { id: true },
    });
    if (alerted) return;

    this.logger.error(`webhook subscription ${subscriptionId} exhausted: ${reason}`);
    await this.ledger.recordAlert(this.prisma, {
      icon: '⚠',
      title: EXHAUSTED_TITLE,
      body: `Subscription ${subscriptionId}: ${reason}. Deliveries to this target are being dropped after ${this.maxAttempts} attempts.`,
    });
  }
}
