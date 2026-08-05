import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { AssessmentResult } from './assessment.service';
import { ExplanationService, prompt } from './explanation.service';

/**
 * PRD §6.5: AI may analyse risk, but deterministic policies must control
 * funds. So what is worth testing is not the prose — it is that nothing
 * here can reach a number.
 */
function result(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    score: 74,
    previousScore: 68,
    tier: 'Standard',
    limit: 2_440,
    previousLimit: 1_690,
    bindingKey: 'quality',
    ladder: [
      { key: 'quality', label: 'Quality-derived limit', formula: 'a × b', value: 2_444.34 },
      { key: 'horizon', label: 'Repayment-horizon limit', formula: 'c × d', value: 3_664.86 },
    ],
    penalties: [] as never,
    components: [
      { key: 'uptime', label: 'Uptime', weight: 0.2, value: 0.95, contribution: 19 },
    ] as never,
    quality: 0.9095,
    model: 'riv-uw-2.1',
    assessedAt: '2026-08-04T00:00:00.000Z',
    ...overrides,
  };
}

function config(key = ''): ConfigService {
  const values: Record<string, unknown> = {
    openRouterApiKey: key,
    openRouterUrl: 'https://openrouter.test/chat',
    explanationModel: 'anthropic/claude-sonnet-4.5',
  };
  return { get: (name: string) => values[name] } as ConfigService;
}

/** An OpenRouter response, OpenAI-compatible. */
function completion(content: string, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('when nothing is configured', () => {
  it('reports itself unconfigured and explains nothing', async () => {
    const service = new ExplanationService(config());

    expect(service.configured).toBe(false);
    expect(await service.explain(result(), '0xtest')).toBeNull();
  });
});

describe('failure is not an outage', () => {
  /**
   * An assessment must not fail because a language model was unreachable.
   * The ladder is the record; this is a reading of it.
   */
  it('returns null when the request throws', async () => {
    const broken = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;

    const service = new ExplanationService(config('sk-test'), broken);
    expect(await service.explain(result(), '0xtest')).toBeNull();
  });

  it('returns null on a non-2xx, which is what an unknown model slug is', async () => {
    const service = new ExplanationService(config('sk-test'), completion('', 400));
    expect(await service.explain(result(), '0xtest')).toBeNull();
  });

  it('returns null when the body carries a provider error', async () => {
    const errored = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 200 }),
    ) as unknown as typeof fetch;

    const service = new ExplanationService(config('sk-test'), errored);
    expect(await service.explain(result(), '0xtest')).toBeNull();
  });

  it('returns null on an empty completion rather than an empty string', async () => {
    const service = new ExplanationService(config('sk-test'), completion('   '));
    expect(await service.explain(result(), '0xtest')).toBeNull();
  });

  it('returns the text when the provider answers', async () => {
    const service = new ExplanationService(
      config('sk-test'),
      completion('  Your limit is held by quality.  '),
    );

    expect(await service.explain(result(), '0xtest')).toBe('Your limit is held by quality.');
  });
});

describe('the request', () => {
  it('goes to OpenRouter with the configured model and the key', async () => {
    const send = completion('ok');
    const service = new ExplanationService(config('sk-test'), send);

    await service.explain(result(), '0xtest');

    const [url, init] = (send as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!;
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(init.body as string) as {
      model: string;
      messages: { role: string; content: string }[];
    };

    expect(url).toBe('https://openrouter.test/chat');
    expect(headers.authorization).toBe('Bearer sk-test');
    expect(body.model).toBe('anthropic/claude-sonnet-4.5');
    // System first, then the decided outcome. The model is told, not asked.
    expect(body.messages[0]!.role).toBe('system');
    expect(body.messages[0]!.content).toContain('You are not deciding anything');
    expect(body.messages[1]!.content).toContain('the decided outcome');
  });

  it('is not sent at all when there is no key', async () => {
    const send = completion('ok');
    const service = new ExplanationService(config(), send);

    await service.explain(result(), '0xtest');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('the prompt', () => {
  it('states the decision as settled, and marks the binding rung', () => {
    const text = prompt(result(), '0x9c4e…a7f1');

    expect(text).toContain('has been assessed. This is the decided outcome');
    expect(text).toContain('2440.00 USDC');
    expect(text).toContain('Binding rung:  quality');
    // The arrow marks which rung bound; the model is told, not asked.
    expect(text).toMatch(/→ Quality-derived limit/);
    expect(text).toMatch(/ {2}Repayment-horizon limit/);
  });

  it('carries no instruction that could be read as a request to re-decide', () => {
    const text = prompt(result(), '0xtest').toLowerCase();

    // The prompt says "the decided outcome" — the decision is stated as
    // settled fact, which is the point. What must be absent is any phrasing
    // that invites a different one.
    expect(text).toContain('the decided outcome');
    expect(text).not.toMatch(/should the limit|what limit|recommend a|choose a limit|set the limit/);
    expect(text).not.toMatch(/decide the|deciding the/);
  });

  it('passes only figures that were computed, never a blank to fill', () => {
    // Every number in the prompt comes from the result object. A prompt that
    // asked the model to supply one would be a decision surface.
    const text = prompt(result({ limit: 999.5, score: 41 }), '0xtest');

    expect(text).toContain('999.50 USDC');
    expect(text).toContain('Risk score:    41');
    expect(text).not.toMatch(/\{\{|\bTODO\b|__/);
  });
});
