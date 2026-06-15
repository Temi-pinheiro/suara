/**
 * Composition root (SDK/DB-free): wire core + providers + store into TurnDeps,
 * routed by LanguageConfig — never by `if (lang === ...)`. Adding a language is a
 * new config + curriculum seed + provider bindings, with zero diffs here.
 *
 * The real Anthropic client and Drizzle stores are constructed in prod.ts so this
 * module (and the handler tests) stay free of vendor SDKs.
 */

import { loadCurriculum } from '@suara/curriculum';
import {
  CoachedPronunciationProvider,
  MockASRProvider,
  MockPronunciationProvider,
  MockTTSProvider,
} from '@suara/providers';
import type {
  ASRProvider,
  CurriculumGraph,
  LLMProvider,
  LanguageConfig,
  LearnerStore,
  PronunciationProvider,
  TTSProvider,
  TurnDeps,
} from '@suara/core';

export interface AssembleOptions {
  config: LanguageConfig;
  store: LearnerStore;
  /** the brain — required; prod injects AnthropicProvider, tests inject MockLLM */
  llm: LLMProvider;
  graph?: CurriculumGraph;
  tts?: TTSProvider;
  asr?: ASRProvider;
  pronunciation?: PronunciationProvider;
}

export function assembleTurnDeps(opts: AssembleOptions): TurnDeps {
  return {
    config: opts.config,
    store: opts.store,
    llm: opts.llm,
    graph: opts.graph ?? loadCurriculum(opts.config.code),
    tts: opts.tts ?? new MockTTSProvider(),
    asr: opts.asr ?? new MockASRProvider(),
    pronunciation: opts.pronunciation ?? pronunciationFor(opts.config),
  };
}

/** Route the pronunciation layer by MODE: tone/segmental score, coached doesn't. */
export function pronunciationFor(config: LanguageConfig): PronunciationProvider {
  if (config.pronunciation.mode === 'coached') return new CoachedPronunciationProvider();
  // Real SpeechSuper (tone) / Azure (segmental) land in the provider tasks; until
  // then the scored path uses the mock scorer. The routing stays mode-driven.
  return new MockPronunciationProvider();
}
