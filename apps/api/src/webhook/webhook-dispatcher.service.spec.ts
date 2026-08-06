import { createHmac } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { LedgerService } from '../ledger/ledger.service';
import type { PrismaService } from '../prisma/prisma.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

interface DeliveryRow {
  id: string;
  attempts: number;
  status: string;
  event: { id: string; type: string; at: Date; payload: unknown };
  subscription: { id: string; url: string; secret: string; active: boolean };
}

function config(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    webhookDispatchIntervalMs: 60_000,
    webhookTimeoutMs: 1_000,
    webhookMaxAttempts: 3,
    // Most tests run with the escape hatch on so no DNS resolution happens;
    // the SSRF cases turn it off and use hostnames that resolve locally.
    webhookAllowPrivate: true,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as ConfigService;
}

function harness(due: DeliveryRow[], overrides: Record<string, unknown> = {}) {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const alerts: unknown[] = [];
  let existingAlert: unknown = null;

  const prisma = {
    webhookDelivery: {
      findMany: vi.fn(async () => due),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(args);
        return {};
      }),
    },
    alert: { findFirst: vi.fn(async () => existingAlert) },
  } as unknown as PrismaService;

  const ledger = {
    recordAlert: vi.fn(async (_client: unknown, input: unknown) => {
      alerts.push(input);
      existingAlert = { id: 'alert_1' };
    }),
  } as unknown as LedgerService;

  const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));

  const service = new WebhookDispatcherService(
    prisma,
    ledger,
    config(overrides),
    fetchImpl as unknown as typeof fetch,
  );
  return { service, updates, alerts, fetchImpl };
}

function delivery(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: 'del_1',
    attempts: 0,
    status: 'pending',
    event: {
      id: 'evt_1',
      type: 'credit.draw.completed',
      at: new Date('2026-08-05T00:00:00.000Z'),
      payload: { handle: '0xabc', amount: 5 },
    },
    subscription: {
      id: 'sub_1',
      url: 'http://localhost:9999/hook',
      secret: 'whsec_test',
      active: true,
    },
    ...overrides,
  };
}

describe('deliver', () => {
  it('posts the signed envelope and marks the delivery delivered', async () => {
    const { service, updates, fetchImpl } = harness([delivery()]);

    await service.tick();

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:9999/hook');

    const body = init.body as string;
    const headers = init.headers as Record<string, string>;
    expect(JSON.parse(body)).toEqual({
      id: 'evt_1',
      type: 'credit.draw.completed',
      at: '2026-08-05T00:00:00.000Z',
      data: { handle: '0xabc', amount: 5 },
    });
    // The receiver's verification, performed here: recompute the HMAC over
    // the raw body with the shared secret. If the signing input ever drifts
    // from the delivered bytes, every integration breaks at once.
    const expected = createHmac('sha256', 'whsec_test').update(body).digest('hex');
    expect(headers['x-rivora-signature']).toBe(`sha256=${expected}`);
    expect(headers['x-rivora-delivery']).toBe('del_1');
    expect(headers['x-rivora-event']).toBe('credit.draw.completed');

    expect(updates).toHaveLength(1);
    expect(updates[0]!.data.status).toBe('delivered');
    expect(updates[0]!.data.attempts).toBe(1);
  });

  it('backs off and retries on a failing receiver', async () => {
    const { service, updates, fetchImpl } = harness([delivery()]);
    fetchImpl.mockResolvedValue(new Response('no', { status: 500 }));

    await service.tick();

    expect(updates).toHaveLength(1);
    const data = updates[0]!.data;
    // Still pending — status is untouched, only the retry bookkeeping moves.
    expect(data.status).toBeUndefined();
    expect(data.attempts).toBe(1);
    expect(data.lastError).toBe('receiver answered 500');
    expect((data.nextAttemptAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('exhausts after the final attempt and raises one ops alert per subscription', async () => {
    const rows = [delivery({ attempts: 2 }), delivery({ id: 'del_2', attempts: 2 })];
    const { service, updates, alerts, fetchImpl } = harness(rows);
    fetchImpl.mockResolvedValue(new Response('no', { status: 503 }));

    await service.tick();

    expect(updates.map((u) => u.data.status)).toEqual(['exhausted', 'exhausted']);
    // Two dead deliveries, one alert: a dead receiver exhausts everything
    // queued behind it, and forty copies of one fact is how alerts get ignored.
    expect(alerts).toHaveLength(1);
  });

  it('refuses a target that resolves privately, without sending anything', async () => {
    const { service, updates, fetchImpl } = harness(
      [
        delivery({
          subscription: { id: 'sub_1', url: 'https://localhost/hook', secret: 's', active: true },
        }),
      ],
      { webhookAllowPrivate: false },
    );

    await service.tick();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates[0]!.data.status).toBe('exhausted');
    expect(String(updates[0]!.data.lastError)).toContain('private address');
  });

  it('refuses a plain-HTTP target when the escape hatch is off', async () => {
    const { service, updates, fetchImpl } = harness(
      [
        delivery({
          subscription: { id: 'sub_1', url: 'http://example.com/hook', secret: 's', active: true },
        }),
      ],
      { webhookAllowPrivate: false },
    );

    await service.tick();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates[0]!.data.status).toBe('exhausted');
    expect(updates[0]!.data.lastError).toBe('target is not HTTPS');
  });

  it('exhausts deliveries for a disabled subscription instead of sending', async () => {
    const { service, updates, fetchImpl } = harness([
      delivery({
        subscription: { id: 'sub_1', url: 'http://localhost:9999/hook', secret: 's', active: false },
      }),
    ]);

    await service.tick();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates[0]!.data.status).toBe('exhausted');
    expect(updates[0]!.data.lastError).toBe('subscription_disabled');
  });
});
