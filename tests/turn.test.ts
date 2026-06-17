/**
 * Golden-path turn lifecycle — the Phase 0 acceptance gate (PLAN.md §10).
 *
 * Proves the full construct -> score -> coach -> recombine loop runs end-to-end on
 * mocks for BOTH a scored (tone / Mandarin) and a coached (Indonesian) config,
 * with ZERO core diffs between them — the language-agnostic engine claim.
 */

import { describe, expect, it } from 'vitest';
import {
  assertNoForbiddenPhrases,
  buildSystemPrompt,
  planTurn,
  runTurn,
} from '@suara/core';
import type { Component, LanguageConfig, TurnDecision, TurnDeps } from '@suara/core';
import { DagCurriculumGraph, loadCurriculum } from '@suara/curriculum';
import {
  CoachedPronunciationProvider,
  InMemoryLearnerStore,
  MockASRProvider,
  MockLLMProvider,
  MockPronunciationProvider,
  MockTTSProvider,
  spokenAudio,
} from '@suara/providers';

const FIXED = 1_700_000_000_000;
const clock = () => FIXED;

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

const jpnConfig: LanguageConfig = {
  code: 'jpn',
  l1: 'eng',
  phonology: 'pitch-accent',
  tts: { provider: 'mock', targetVoiceId: 'jpn-native', l1VoiceId: 'eng-warm' },
  pronunciation: { mode: 'segmental', provider: 'mock' },
};

const cmnMatesConfig: LanguageConfig = {
  ...cmnConfig,
  tts: { ...cmnConfig.tts, classmateVoiceIds: ['classmate-1'] },
  classmates: true,
};

/** A 2-block Indonesian graph: proves a new language = config + graph, no core diff. */
const indComponents: Component[] = [
  { id: 'i01', lang: 'ind', kind: 'function', surface: 'saya', glossEn: 'I / me', prereqIds: [], rule: 'subject slot' },
  { id: 'i02', lang: 'ind', kind: 'function', surface: 'mau', glossEn: 'to want', prereqIds: ['i01'], rule: 'saya + mau + thing' },
];

/** The learner "speaks" the target perfectly. */
const speakTarget = async (d: TurnDecision) => spokenAudio(d.referenceText);

function noForbiddenCopy(d: TurnDecision, correction: string, nextPrompt: string | null): void {
  assertNoForbiddenPhrases(`${d.englishSetup} ${d.teachingNote} ${correction} ${nextPrompt ?? ''}`);
}

describe('golden-path turn lifecycle — tone (Mandarin)', () => {
  function makeDeps(pron = new MockPronunciationProvider()) {
    const tts = new MockTTSProvider();
    const asr = new MockASRProvider();
    const store = new InMemoryLearnerStore(clock);
    const llm = new MockLLMProvider();
    const graph = loadCurriculum('cmn', clock);
    const deps: TurnDeps = { config: cmnConfig, llm, tts, asr, pronunciation: pron, store, graph };
    return { deps, tts, asr, store, llm, pron };
  }

  it('introduces the first block, scores it, and advances', async () => {
    const { deps, tts, asr, pron, store } = makeDeps();

    const r = await runTurn(deps, { userId: 'u1', capture: speakTarget, now: clock });

    // PLAN: smallest unlocked block first
    expect(r.decision.action).toBe('introduce');
    expect(r.decision.focusComponentId).toBe('c01');
    expect(r.decision.classmateAttempt).toBeNull(); // off by default (decision #4)

    // SCORE: ASR ∥ pronunciation both ran (tone mode uses the scorer)
    expect(asr.callCount).toBe(1);
    expect(pron.callCount).toBe(1);
    expect(r.transcript).toBe('我');
    expect(r.pronScore?.overall).toBe(92);

    // REACT + SPEAK
    expect(r.feedback.verdict).toBe('correct');
    expect(r.feedback.decision).toBe('advance');
    expect(r.modelAudio.text).toBe('我');
    expect(r.promptAudio.setup).toBeDefined();

    // PERSIST: c01 is now known; one turn recorded
    expect(r.state.known).toContain('c01');
    expect(r.state.turnIndex).toBe(1);
    expect(store.turns).toHaveLength(1);

    // MT copy gate: brain never emits forbidden phrases
    noForbiddenCopy(r.decision, r.feedback.correction, r.feedback.nextPrompt);
    expect(tts.synthCount).toBeGreaterThan(0);
  });

  it('advances progression across turns (c01 -> c02)', async () => {
    const { deps } = makeDeps();
    await runTurn(deps, { userId: 'u2', capture: speakTarget, now: clock });
    const r2 = await runTurn(deps, { userId: 'u2', capture: speakTarget, now: clock });

    expect(r2.decision.focusComponentId).toBe('c02');
    expect(r2.state.known).toEqual(expect.arrayContaining(['c01', 'c02']));
    expect(r2.state.turnIndex).toBe(2);
  });

  it('coaches a tone miss into a rebuild and logs the error grain', async () => {
    const pron = new MockPronunciationProvider({
      byReference: {
        我: { overall: 60, perSyllable: [{ unit: '我', score: 55, expectedTone: '3', producedTone: '2' }] },
      },
    });
    const { deps } = makeDeps(pron);

    const r = await runTurn(deps, { userId: 'u3', capture: speakTarget, now: clock });

    expect(r.feedback.verdict).toBe('close');
    expect(r.feedback.decision).toBe('rebuild');
    expect(r.feedback.nextPrompt).not.toBeNull();
    expect(r.record.errorDetail).toEqual([
      { unit: '我', expected: '3', produced: '2', score: 55 },
    ]);
    // rebuild keeps the block OUT of known so the next turn retries it
    expect(r.state.known).not.toContain('c01');
    noForbiddenCopy(r.decision, r.feedback.correction, r.feedback.nextPrompt);
  });
});

describe('golden-path turn lifecycle — coached (Indonesian)', () => {
  it('runs the full loop with NO scorer call and feels identical', async () => {
    const tts = new MockTTSProvider();
    const asr = new MockASRProvider();
    const store = new InMemoryLearnerStore(clock);
    const llm = new MockLLMProvider();
    const pron = new CoachedPronunciationProvider();
    const graph = new DagCurriculumGraph(indComponents, clock);
    const deps: TurnDeps = { config: indConfig, llm, tts, asr, pronunciation: pron, store, graph };

    const r = await runTurn(deps, { userId: 'u4', capture: speakTarget, now: clock });

    // coached mode skips the scorer ENTIRELY (CLAUDE.md §6)
    expect(pron.callCount).toBe(0);
    expect(r.pronScore).toBeNull();

    // ...but the rest of the loop is unchanged
    expect(asr.callCount).toBe(1);
    expect(r.decision.focusComponentId).toBe('i01');
    expect(r.transcript).toBe('saya');
    expect(r.feedback.decision).toBe('advance');
    expect(r.modelAudio.text).toBe('saya');
    expect(r.state.known).toContain('i01');

    // warm + specific, never a number, never a forbidden phrase
    expect(r.feedback.correction.length).toBeGreaterThan(0);
    expect(/\d/.test(r.feedback.correction)).toBe(false);
    noForbiddenCopy(r.decision, r.feedback.correction, r.feedback.nextPrompt);
  });
});

describe('golden-path turn lifecycle — segmental (Japanese)', () => {
  it('runs the scorer and advances on a real jpn graph, with zero core diffs', async () => {
    const tts = new MockTTSProvider();
    const asr = new MockASRProvider();
    const store = new InMemoryLearnerStore(clock);
    const llm = new MockLLMProvider();
    const pron = new MockPronunciationProvider();
    const graph = loadCurriculum('jpn', clock);
    const deps: TurnDeps = { config: jpnConfig, llm, tts, asr, pronunciation: pron, store, graph };

    const r = await runTurn(deps, { userId: 'u-jpn', capture: speakTarget, now: clock });

    // smallest unlocked block of the SEEDED Japanese graph
    expect(r.decision.focusComponentId).toBe('j01');
    // segmental DOES score (unlike coached) — same engine, different mode
    expect(pron.callCount).toBe(1);
    expect(r.pronScore).not.toBeNull();
    expect(r.transcript).toBe('わたし');
    expect(r.feedback.decision).toBe('advance');
    expect(r.state.known).toContain('j01');
    noForbiddenCopy(r.decision, r.feedback.correction, r.feedback.nextPrompt);
  });
});

describe('simulated classmates (opt-in, off by default — decision #4)', () => {
  function makeDeps(config: LanguageConfig): TurnDeps {
    return {
      config,
      llm: new MockLLMProvider(),
      tts: new MockTTSProvider(),
      asr: new MockASRProvider(),
      pronunciation: new MockPronunciationProvider(),
      store: new InMemoryLearnerStore(clock),
      graph: loadCurriculum('cmn', clock),
    };
  }

  it('stays silent by default (no attempt, no audio)', async () => {
    const plan = await planTurn(makeDeps(cmnConfig), 'u-no-mates');
    expect(plan.decision.classmateAttempt).toBeNull();
    expect(plan.promptAudio.classmate).toBeUndefined();
  });

  it('adds a classmate attempt AND synthesizes its audio when the config opts in', async () => {
    const plan = await planTurn(makeDeps(cmnMatesConfig), 'u-mates');
    expect(plan.decision.classmateAttempt).not.toBeNull();
    expect(plan.promptAudio.classmate).toBeDefined();
  });
});

describe('persona', () => {
  it('builds an interpolated system prompt per language', () => {
    const prompt = buildSystemPrompt(cmnConfig);
    expect(prompt).toContain('Mandarin Chinese');
    expect(prompt).toContain('English');
    expect(prompt).toContain('mode = tone');

    expect(buildSystemPrompt(indConfig)).toContain('mode = coached');
  });
});
