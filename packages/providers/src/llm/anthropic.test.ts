import { describe, expect, it } from 'vitest';
import type { LanguageConfig, ScoredResponse, TurnContext } from '@suara/core';
import {
  AnthropicProvider,
  type AnthropicClientLike,
  type AnthropicCreateParams,
  type AnthropicResponse,
} from './anthropic';

const cmnConfig: LanguageConfig = {
  code: 'cmn',
  l1: 'eng',
  phonology: 'tonal',
  toneInventory: ['1', '2', '3', '4', '0'],
  tts: { provider: 'mock', targetVoiceId: 'cmn-native', l1VoiceId: 'eng-warm' },
  pronunciation: { mode: 'tone', provider: 'speechsuper' },
};

const ctx: TurnContext = {
  language: { code: 'cmn', l1: 'eng', phonology: 'tonal', pronunciationMode: 'tone', toneInventory: ['1', '2', '3', '4', '0'] },
  session: { turnIndex: 0, lastTurns: [] },
  known: [],
  availableBlocks: [{ id: 'c01', surface: '我 (wǒ)', glossEn: 'I / me', rule: 'subject slot', expectedTones: '3' }],
  recombinationTargets: [],
};

/** A mock Anthropic client that records calls and returns a scripted response. */
function mockClient(reply: AnthropicResponse) {
  const calls: AnthropicCreateParams[] = [];
  const client: AnthropicClientLike = {
    messages: {
      create: async (params) => {
        calls.push(params);
        return reply;
      },
    },
  };
  return { client, calls };
}

function toolUseReply(name: string, input: unknown): AnthropicResponse {
  return { content: [{ type: 'tool_use', id: 'toolu_1', name, input }], stop_reason: 'tool_use' };
}

/** A mock client that returns a queued reply per call (repeats the last one if exhausted). */
function sequencedClient(replies: AnthropicResponse[]) {
  const calls: AnthropicCreateParams[] = [];
  const client: AnthropicClientLike = {
    messages: {
      create: async (params) => {
        calls.push(params);
        return replies[Math.min(calls.length - 1, replies.length - 1)]!;
      },
    },
  };
  return { client, calls };
}

const validDecision = {
  action: 'introduce',
  focusComponentId: 'c01',
  recombinedComponentIds: [],
  englishSetup: 'Here is the first small piece. How would you say it? Take your time.',
  targetUtterance: { surface: '我', expectedTones: '3' },
  referenceText: '我',
  teachingNote: '我 is the subject slot.',
  classmateAttempt: null,
  reassurance: null,
};

const validFeedback = {
  verdict: 'correct',
  spokenModel: '我',
  correction: 'That is it — nicely balanced.',
  decision: 'advance',
  masteryDelta: [{ componentId: 'c01', change: 'strengthen' }],
  nextPrompt: null,
  revealNote: null,
};

describe('AnthropicProvider.decideTurn', () => {
  it('forces the decision tool, caches the system prefix, and validates output', async () => {
    const { client, calls } = mockClient(toolUseReply('emit_turn_decision', validDecision));
    const provider = new AnthropicProvider({ client, config: cmnConfig, curriculumContext: 'GRAPH...' });

    const decision = await provider.decideTurn(ctx);

    expect(decision.focusComponentId).toBe('c01');
    expect(decision.referenceText).toBe('我');

    const call = calls[0]!;
    expect(call.model).toBe('claude-haiku-4-5'); // routine tier
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'emit_turn_decision' });
    // cache breakpoint on the LAST system block (persona + curriculum context)
    expect(call.system).toHaveLength(2);
    expect(call.system[1]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(call.system[0]!.cache_control).toBeUndefined();
  });

  it('throws if the brain keeps emitting a forbidden MT phrase', async () => {
    const bad = { ...validDecision, teachingNote: 'Try to memorize this one.' };
    const { client } = mockClient(toolUseReply('emit_turn_decision', bad));
    const provider = new AnthropicProvider({ client, config: cmnConfig });

    await expect(provider.decideTurn(ctx)).rejects.toThrow(/forbidden persona phrase/);
  });

  it('regenerates with a nudge and recovers when a draft trips the persona gate', async () => {
    const bad = { ...validDecision, teachingNote: 'Try to memorize this one.' };
    const { client, calls } = sequencedClient([
      toolUseReply('emit_turn_decision', bad),
      toolUseReply('emit_turn_decision', validDecision),
    ]);
    const provider = new AnthropicProvider({ client, config: cmnConfig });

    const decision = await provider.decideTurn(ctx);

    expect(decision.teachingNote).toBe('我 is the subject slot.'); // the clean retry won
    expect(calls).toHaveLength(2); // one slip, one regeneration
    // the retry names the offending word back to the model so it rephrases it out
    expect(calls[1]!.messages[0]!.content).toMatch(/forbidden word "memorize"/);
  });

  it('throws if no tool_use block is returned', async () => {
    const { client } = mockClient({ content: [{ type: 'text' }], stop_reason: 'end_turn' });
    const provider = new AnthropicProvider({ client, config: cmnConfig });

    await expect(provider.decideTurn(ctx)).rejects.toThrow(/expected a emit_turn_decision/);
  });
});

describe('AnthropicProvider.interpretResponse — model tiering', () => {
  const scored = (pronScore: ScoredResponse['pronScore']): ScoredResponse => ({
    decision: validDecision as never,
    transcript: '我',
    pronScore,
  });

  it('uses the strong model on a miss', async () => {
    const { client, calls } = mockClient(toolUseReply('emit_feedback', validFeedback));
    const provider = new AnthropicProvider({ client, config: cmnConfig });

    await provider.interpretResponse(
      scored({ overall: 55, perSyllable: [{ unit: '我', score: 55, expectedTone: '3', producedTone: '2' }] }),
      ctx,
    );

    expect(calls[0]!.model).toBe('claude-opus-4-8');
  });

  it('uses the routine model on a clean attempt', async () => {
    const { client, calls } = mockClient(toolUseReply('emit_feedback', validFeedback));
    const provider = new AnthropicProvider({ client, config: cmnConfig });

    await provider.interpretResponse(
      scored({ overall: 95, perSyllable: [{ unit: '我', score: 95 }] }),
      ctx,
    );

    expect(calls[0]!.model).toBe('claude-haiku-4-5');
  });

  it('uses the routine model in coached mode (null score)', async () => {
    const { client, calls } = mockClient(toolUseReply('emit_feedback', validFeedback));
    const provider = new AnthropicProvider({ client, config: cmnConfig });

    await provider.interpretResponse(scored(null), ctx);

    expect(calls[0]!.model).toBe('claude-haiku-4-5');
  });
});
