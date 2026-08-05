import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AssessmentResult } from './assessment.service';

/**
 * The decision, put into words. PRD §35.4, and §6.5 for why it works this way.
 *
 * §6.5 is the governing constraint: *AI may analyse risk, but deterministic
 * policies must control funds.* So this runs strictly downstream of a limit
 * that has already been computed, stored and enforced. It receives the
 * outcome and describes it. There is no path by which anything here changes
 * a number — not the score, not the tier, not the limit — and that is a
 * property of the wiring rather than of the prompt: `reassess` has committed
 * before this is called, and the only thing it writes back is prose.
 *
 * ## Why bother, when the ladder is already explainable
 *
 * The constraint ladder says *which rung binds* and shows the arithmetic. A
 * borrower reading "quality: 12,216.21 × 0.20 × 0.9095 × 1.10" can verify it
 * and cannot necessarily act on it. The sentence worth having is the one
 * that names the specific thing to fix. The ladder remains the record; this
 * is a reading of it.
 *
 * ## When it is absent
 *
 * No API key, an error, a timeout — the explanation is simply missing and
 * every surface falls back to the ladder, which never needed it. An
 * underwriting decision must not depend on a third party being reachable.
 */

/** Bounded so a slow provider cannot hold an assessment open. */
const TIMEOUT_MS = 12_000;
const MAX_TOKENS = 350;

interface AnthropicClient {
  messages: {
    create(body: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: 'user'; content: string }[];
    }): Promise<{ content: { type: string; text?: string }[] }>;
  };
}

const SYSTEM = [
  'You explain credit decisions that have already been made by a deterministic underwriting engine.',
  '',
  'You are not deciding anything. The limit, score and tier are fixed inputs; your job is to say, in plain language, what produced them and what the borrower could change.',
  '',
  'Rules:',
  '- Never suggest the limit should be different. It is not yours to revise.',
  '- Never invent a figure. Use only the numbers given.',
  '- Lead with the binding constraint — the one rung that decided the limit. The others did not.',
  '- Say what would move it, concretely, if the inputs support that.',
  '- Three sentences at most. No preamble, no headings, no bullet points.',
  '- Address the borrower as "you". Plain words: "customer concentration", not "HHI".',
].join('\n');

@Injectable()
export class ExplanationService {
  private readonly logger = new Logger(ExplanationService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private client: AnthropicClient | null = null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('anthropicApiKey') ?? '';
    this.model = config.get<string>('explanationModel') ?? 'claude-sonnet-5';
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Narrates one assessment. Returns null rather than throwing: a missing
   * explanation is a cosmetic loss, and an assessment that failed because a
   * language model was unavailable would be an outage of the lending
   * protocol caused by a narrator.
   */
  async explain(result: AssessmentResult, handle: string): Promise<string | null> {
    if (!this.configured) return null;

    try {
      const client = await this.connect();
      const response = await Promise.race([
        client.messages.create({
          model: this.model,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt(result, handle) }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS),
        ),
      ]);

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('')
        .trim();

      return text.length > 0 ? text : null;
    } catch (cause) {
      this.logger.warn(`no explanation for ${handle}: ${String(cause)}`);
      return null;
    }
  }

  private async connect(): Promise<AnthropicClient> {
    if (!this.client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey: this.apiKey }) as unknown as AnthropicClient;
    }
    return this.client;
  }
}

/**
 * Everything the model is allowed to know, and nothing it could mistake for
 * a request to re-decide. The decision is stated as settled fact.
 */
export function prompt(result: AssessmentResult, handle: string): string {
  const ladder = (result.ladder as { key: string; label: string; formula: string; value: number }[])
    .map(
      (rung) =>
        `  ${rung.key === result.bindingKey ? '→' : ' '} ${rung.label}: ${rung.formula} = ${rung.value.toFixed(2)} USDC`,
    )
    .join('\n');

  const components = result.components
    .map((c) => `  ${c.label}: ${c.value.toFixed(3)} (weight ${c.weight})`)
    .join('\n');

  return [
    `Borrower ${handle} has been assessed. This is the decided outcome:`,
    '',
    `  Credit limit:  ${result.limit.toFixed(2)} USDC (previously ${result.previousLimit.toFixed(2)})`,
    `  Risk score:    ${result.score} (previously ${result.previousScore})`,
    `  Tier:          ${result.tier}`,
    `  Binding rung:  ${result.bindingKey}`,
    '',
    'The constraint ladder. The lowest rung binds; → marks it:',
    ladder,
    '',
    'Score components:',
    components,
    '',
    'Explain this to the borrower.',
  ].join('\n');
}
