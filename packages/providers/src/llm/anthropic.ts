/**
 * AnthropicProvider — the real "teacher brain" (implements LLMProvider).
 *
 * Honors CLAUDE.md §6 + brain-spec §5:
 *  - Model tiering: a fast/cheap model handles routine decideTurn; a stronger model
 *    is reserved for interpretResponse on misses (diagnosis). Both are overridable.
 *  - Prompt caching: the persona + (optional) curriculum context are a static prefix
 *    cached via cache_control on the last system block; only the per-turn TurnContext
 *    varies (uncached). Render order is tools -> system -> messages, so the breakpoint
 *    on the last system block caches tools + system together.
 *  - Structured output: forced tool use (one tool per function) so the brain can only
 *    emit valid JSON; validated before use, with the persona gate applied to copy.
 *
 * The Anthropic client is injected so tests run on a mock (no live calls in CI).
 */

import {
  assertFeedback,
  assertTurnDecision,
  buildSystemPrompt,
  FEEDBACK_SCHEMA,
  findForbiddenPhrase,
  FORBIDDEN_PERSONA_PHRASES,
  TURN_DECISION_SCHEMA,
} from '@suara/core';
import { stripRomanization } from './mock';
import type {
  Feedback,
  LLMProvider,
  LanguageConfig,
  PronScore,
  ScoredResponse,
  TurnContext,
  TurnDecision,
} from '@suara/core';

// --- Minimal structural surface of the Anthropic SDK we depend on. The real
// `new Anthropic()` satisfies this; tests inject a mock with the same shape. ---

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface AnthropicCreateParams {
  model: string;
  max_tokens: number;
  system: AnthropicTextBlock[];
  tools: AnthropicToolDef[];
  tool_choice: { type: 'tool'; name: string };
  messages: Array<{ role: 'user'; content: string }>;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface AnthropicResponse {
  content: Array<AnthropicToolUseBlock | { type: string }>;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface AnthropicClientLike {
  messages: { create(params: AnthropicCreateParams): Promise<AnthropicResponse> };
}

export interface AnthropicProviderOptions {
  config: LanguageConfig;
  /** injected SDK client; defaults to a real `new Anthropic()` (reads ANTHROPIC_API_KEY) */
  client?: AnthropicClientLike;
  /** model tiering — CLAUDE.md §6. Defaults: routine=Haiku 4.5, strong=Opus 4.8. */
  models?: { routine?: string; strong?: string };
  /** static curriculum context cached alongside the persona (the big cost lever) */
  curriculumContext?: string;
  maxTokens?: number;
}

const DECIDE_TURN_TOOL: AnthropicToolDef = {
  name: 'emit_turn_decision',
  description:
    'Emit the next turn the learner should build: the new block (or recombination), ' +
    'the L1 setup, the target utterance, and the reference text for scoring.',
  input_schema: TURN_DECISION_SCHEMA,
};

const FEEDBACK_TOOL: AnthropicToolDef = {
  name: 'emit_feedback',
  description:
    'Emit warm feedback on the learner attempt: reveal the model, at most one kind ' +
    'correction (or specific praise), the next move (advance/rebuild/ease), and mastery deltas.',
  input_schema: FEEDBACK_SCHEMA,
};

/**
 * How many times to regenerate when the brain's copy trips the persona gate.
 * The model is nondeterministic, so a one-off slip (e.g. it says "remember")
 * almost never repeats once we name the offending word back to it. Rejection
 * sampling keeps the MT gate strict without crashing a live turn over a fluke.
 */
const MAX_PERSONA_RETRIES = 2;

/** A miss worth the stronger model: low overall or any weak syllable. */
function isMiss(pronScore: PronScore | null): boolean {
  if (!pronScore) return false; // coached: no score -> routine model
  if (pronScore.overall !== null && pronScore.overall < 80) return true;
  return pronScore.perSyllable.some((s) => s.score < 70);
}

export class AnthropicProvider implements LLMProvider {
  private readonly config: LanguageConfig;
  private readonly client: AnthropicClientLike;
  private readonly routineModel: string;
  private readonly strongModel: string;
  private readonly curriculumContext: string | undefined;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions) {
    this.config = options.config;
    this.routineModel = options.models?.routine ?? 'claude-haiku-4-5';
    this.strongModel = options.models?.strong ?? 'claude-opus-4-8';
    this.curriculumContext = options.curriculumContext;
    this.maxTokens = options.maxTokens ?? 2048;

    if (options.client) {
      this.client = options.client;
    } else {
      // Lazy require so importing this module without a key/SDK doesn't throw;
      // the real client is only constructed when no mock is injected.
      throw new Error(
        'AnthropicProvider requires an injected client. Construct `new Anthropic()` ' +
          'in the composition root (packages/server) and pass it as `client`.',
      );
    }
  }

  /** Persona + optional curriculum context, with the cache breakpoint on the last block. */
  private buildSystem(): AnthropicTextBlock[] {
    const blocks: AnthropicTextBlock[] = [{ type: 'text', text: buildSystemPrompt(this.config) }];
    if (this.curriculumContext) {
      blocks.push({ type: 'text', text: this.curriculumContext });
    }
    const last = blocks[blocks.length - 1];
    if (last) last.cache_control = { type: 'ephemeral' };
    return blocks;
  }

  private toolUseInput(res: AnthropicResponse, toolName: string): unknown {
    const block = res.content.find(
      (b): b is AnthropicToolUseBlock => b.type === 'tool_use' && (b as AnthropicToolUseBlock).name === toolName,
    );
    if (!block) {
      throw new Error(`AnthropicProvider: expected a ${toolName} tool_use block in the response`);
    }
    return block.input;
  }

  /** A retry instruction that names the offending word so the model rephrases it out. */
  private personaNudge(baseContent: string, phrase: string): string {
    return (
      `${baseContent}\n\nYour previous reply used the forbidden word "${phrase}". These words ` +
      `must NEVER appear in any copy you write: ${FORBIDDEN_PERSONA_PHRASES.join(', ')}. ` +
      'Re-emit the JSON with the same meaning and warmth, rephrased so none of them appear.'
    );
  }

  /**
   * Generate a tool call, validate it, and run the persona gate. If the gate trips,
   * regenerate up to MAX_PERSONA_RETRIES times — naming the offending word back to the
   * model — before giving up. `build` returns the validated value and the copy to gate.
   */
  private async generateGated<T>(
    baseContent: string,
    build: (content: string) => Promise<{ value: T; copy: string }>,
  ): Promise<T> {
    let content = baseContent;
    let violation: string | null = null;
    for (let attempt = 0; attempt <= MAX_PERSONA_RETRIES; attempt++) {
      const { value, copy } = await build(content);
      violation = findForbiddenPhrase(copy);
      if (!violation) return value;
      content = this.personaNudge(baseContent, violation);
    }
    throw new Error(
      `AnthropicProvider: brain kept emitting forbidden persona phrase "${violation}" ` +
        `after ${MAX_PERSONA_RETRIES + 1} attempts`,
    );
  }

  async decideTurn(ctx: TurnContext): Promise<TurnDecision> {
    const baseContent =
      'Plan the next turn. Current TurnContext (JSON):\n\n' +
      `${JSON.stringify(ctx, null, 2)}\n\n` +
      'Call emit_turn_decision. Use ONLY blocks from availableBlocks / known.';

    return this.generateGated<TurnDecision>(baseContent, async (content) => {
      const res = await this.client.messages.create({
        model: this.routineModel,
        max_tokens: this.maxTokens,
        system: this.buildSystem(),
        tools: [DECIDE_TURN_TOOL],
        tool_choice: { type: 'tool', name: DECIDE_TURN_TOOL.name },
        messages: [{ role: 'user', content }],
      });

      const decision = assertTurnDecision(this.toolUseInput(res, DECIDE_TURN_TOOL.name));
      // Keep the target script clean (no romanization/English) and pin referenceText to
      // it, so the spoken/displayed target and the scoring reference can't diverge.
      decision.targetUtterance.surface = stripRomanization(decision.targetUtterance.surface);
      decision.referenceText = stripRomanization(decision.targetUtterance.surface);
      const copy = `${decision.englishSetup} ${decision.teachingNote} ${decision.reassurance ?? ''}`;
      return { value: decision, copy };
    });
  }

  async interpretResponse(r: ScoredResponse, ctx: TurnContext): Promise<Feedback> {
    const model = isMiss(r.pronScore) ? this.strongModel : this.routineModel;
    const baseContent =
      'Interpret the learner attempt and respond with feedback. ' +
      'Scored response and original context (JSON):\n\n' +
      `${JSON.stringify({ scored: r, context: ctx }, null, 2)}\n\n` +
      'Call emit_feedback. One warm cue, then decide advance/rebuild/ease.';

    return this.generateGated<Feedback>(baseContent, async (content) => {
      const res = await this.client.messages.create({
        model,
        max_tokens: this.maxTokens,
        system: this.buildSystem(),
        tools: [FEEDBACK_TOOL],
        tool_choice: { type: 'tool', name: FEEDBACK_TOOL.name },
        messages: [{ role: 'user', content }],
      });

      const feedback = assertFeedback(this.toolUseInput(res, FEEDBACK_TOOL.name));
      const copy = `${feedback.correction} ${feedback.nextPrompt ?? ''} ${feedback.revealNote ?? ''}`;
      return { value: feedback, copy };
    });
  }
}
