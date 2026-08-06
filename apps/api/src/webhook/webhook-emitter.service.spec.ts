import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

import { WebhookEmitter } from './webhook-emitter.service';

function fakeTx(subscriptions: Array<{ id: string; active: boolean; events: string[] }>) {
  const findMany = vi.fn(async ({ where }: { where: { events: { has: string } } }) =>
    subscriptions
      .filter((s) => s.active && s.events.includes(where.events.has))
      .map((s) => ({ id: s.id })),
  );
  const create = vi.fn(async () => ({ id: 'evt_1' }));
  const createMany = vi.fn(async () => ({ count: 0 }));

  return {
    tx: {
      webhookSubscription: { findMany },
      webhookEvent: { create },
      webhookDelivery: { createMany },
    } as unknown as Prisma.TransactionClient,
    create,
    createMany,
  };
}

describe('emit', () => {
  it('writes the event and one delivery per matching subscription', async () => {
    const { tx, create, createMany } = fakeTx([
      { id: 'sub_a', active: true, events: ['credit.draw.completed'] },
      { id: 'sub_b', active: true, events: ['credit.draw.completed', 'borrower.defaulted'] },
    ]);

    await new WebhookEmitter().emit(tx, 'credit.draw.completed', { handle: '0xabc', amount: 5 });

    expect(create).toHaveBeenCalledWith({
      data: { type: 'credit.draw.completed', payload: { handle: '0xabc', amount: 5 } },
      select: { id: true },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { eventId: 'evt_1', subscriptionId: 'sub_a' },
        { eventId: 'evt_1', subscriptionId: 'sub_b' },
      ],
    });
  });

  it('writes nothing at all when no active subscription wants the event', async () => {
    const { tx, create, createMany } = fakeTx([
      { id: 'sub_off', active: false, events: ['borrower.defaulted'] },
      { id: 'sub_other', active: true, events: ['revenue.settled'] },
    ]);

    await new WebhookEmitter().emit(tx, 'borrower.defaulted', { handle: '0xabc' });

    expect(create).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });
});
