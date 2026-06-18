import { describe, expect, it } from 'vitest';
import { DagCurriculumGraph } from '@suara/curriculum';
import {
  CoachedPronunciationProvider,
  InMemoryLearnerStore,
  MockASRProvider,
  MockLLMProvider,
  MockPronunciationProvider,
  MockTTSProvider,
  spokenAudio,
} from '@suara/providers';
import type { Component, LanguageConfig } from '@suara/core';
import { assembleTurnDeps, pronunciationFor } from '../compose';
import { attemptHandler, pathHandler, planTurnHandler, type TurnHandlerDeps } from './handlers';
import { InMemoryPendingTurnStore } from './pending';

const clock = () => 1_700_000_000_000;

const cmnConfig: LanguageConfig = {
  code: 'cmn',
  l1: 'eng',
  phonology: 'tonal',
  toneInventory: ['1', '2', '3', '4', '0'],
  tts: { provider: 'mock', targetVoiceId: 'cmn-native', l1VoiceId: 'eng-warm' },
  pronunciation: { mode: 'tone', provider: 'mock' },
};

const indConfig: LanguageConfig = {
  code: 'ind',
  l1: 'eng',
  phonology: 'non-tonal',
  tts: { provider: 'mock', targetVoiceId: 'ind-native', l1VoiceId: 'eng-warm' },
  pronunciation: { mode: 'coached' },
};

const indGraph = new DagCurriculumGraph(
  [{ id: 'i01', lang: 'ind', kind: 'function', surface: 'saya', glossEn: 'I / me', prereqIds: [], rule: 'subject slot' } satisfies Component],
  clock,
);

function cmnHandlers(pron = new MockPronunciationProvider(), idgen = () => 'turn-1') {
  const store = new InMemoryLearnerStore(clock);
  const deps = assembleTurnDeps({
    config: cmnConfig,
    store,
    llm: new MockLLMProvider(),
    tts: new MockTTSProvider(),
    asr: new MockASRProvider(),
    pronunciation: pron,
  });
  const h: TurnHandlerDeps = { deps, pending: new InMemoryPendingTurnStore(), now: clock, idgen };
  return { h, store };
}

describe('turn handlers — two-phase HTTP turn', () => {
  it('plan returns a prompt with no answer leak (construct-first), then attempt advances', async () => {
    const { h, store } = cmnHandlers();

    const packet = await planTurnHandler(h, { userId: 'u1' });
    expect(packet.turnId).toBe('turn-1');
    expect(packet.englishSetup.length).toBeGreaterThan(0);
    expect(packet.setupAudioUrl).toContain('mock://audio/');
    // introduce TEACHES the new block (you can't produce an unheard word) ...
    expect(packet.action).toBe('introduce');
    expect(packet.teach?.surface).toBe('我');
    expect(packet.teach?.pinyin).toBe('wǒ');
    expect(packet.teach?.modelAudioUrl).toContain('mock://audio/');
    // ... but the full target sentence is still never sent pre-attempt
    expect('targetUtterance' in packet).toBe(false);

    const result = await attemptHandler(h, { turnId: 'turn-1', audio: spokenAudio('我') });
    expect(result.decision).toBe('advance');
    expect(result.verdict).toBe('correct');
    expect(result.modelAudioUrl).toContain('mock://audio/');
    // the attempt reveals the model + echoes back what the learner said (never graded)
    expect(result.transcript).toBe('我');
    expect(result.modelSurface).toBe('我');

    const state = await store.getState('u1', 'cmn');
    expect(state.known).toContain('c01'); // persisted through the Drizzle-shaped store interface
    expect(state.turnIndex).toBe(1);
  });

  it('a tone miss comes back as a rebuild carrying the tone to coach', async () => {
    const pron = new MockPronunciationProvider({
      byReference: { 我: { overall: 60, perSyllable: [{ unit: '我', score: 55, expectedTone: '3', producedTone: '2' }] } },
    });
    const { h } = cmnHandlers(pron, () => 't');

    await planTurnHandler(h, { userId: 'u2' });
    const result = await attemptHandler(h, { turnId: 't', audio: spokenAudio('我') });

    expect(result.decision).toBe('rebuild');
    expect(result.verdict).toBe('close');
    expect(result.toneFocus).toBe('3'); // drives the client's tone scaffold
  });

  it('rejects an unknown or already-used turn', async () => {
    const { h } = cmnHandlers();
    await expect(attemptHandler(h, { turnId: 'nope', audio: spokenAudio('x') })).rejects.toThrow(
      /unknown or already-used/,
    );
  });

  it('builds the path overview from module progress (never a score)', async () => {
    const { h } = cmnHandlers();
    const path = await pathHandler(h, { userId: 'u-path' });

    expect(path.modules.length).toBeGreaterThan(0);
    // a brand-new learner: the first module holds the current block, the rest are ahead
    expect(path.modules[0]!.state).toBe('here');
    expect(path.modules[0]!.pieces[0]).toMatchObject({ surface: '我', owned: false, current: true });
    expect(path.modules.slice(1).every((m) => m.state === 'ahead')).toBe(true);
  });
});

describe('composition root — routing by LanguageConfig', () => {
  it('routes the pronunciation layer by mode', () => {
    expect(pronunciationFor(indConfig)).toBeInstanceOf(CoachedPronunciationProvider);
    expect(pronunciationFor(cmnConfig)).toBeInstanceOf(MockPronunciationProvider);
  });

  it('runs a coached (Indonesian) turn with the scorer skipped — zero core diffs', async () => {
    const coachedPron = new CoachedPronunciationProvider();
    const deps = assembleTurnDeps({
      config: indConfig,
      store: new InMemoryLearnerStore(clock),
      llm: new MockLLMProvider(),
      graph: indGraph,
      tts: new MockTTSProvider(),
      asr: new MockASRProvider(),
      pronunciation: coachedPron,
    });
    const h: TurnHandlerDeps = { deps, pending: new InMemoryPendingTurnStore(), now: clock, idgen: () => 'ti' };

    await planTurnHandler(h, { userId: 'u3' });
    const result = await attemptHandler(h, { turnId: 'ti', audio: spokenAudio('saya') });

    expect(coachedPron.callCount).toBe(0); // scorer never called in coached mode
    expect(result.decision).toBe('advance');
    expect(result.toneFocus).toBeUndefined();
  });
});
