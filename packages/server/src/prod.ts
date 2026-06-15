/**
 * Production wiring: constructs the real brain + audio/scoring providers + Drizzle
 * stores from the environment and assembles the turn handlers. Imports the vendor
 * SDKs, so it is kept out of the test path (handler tests use compose.ts + mocks).
 *
 * Secrets come only from `env` — never hard-coded. Providers are routed by
 * LanguageConfig (pronunciation by MODE), so a new language needs no diffs here.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AnthropicProvider,
  CoachedPronunciationProvider,
  ElevenLabsTTSProvider,
  ScribeASRProvider,
  SpeechSuperProvider,
  type AnthropicClientLike,
} from '@suara/providers';
import type { ASRProvider, LanguageConfig, PronunciationProvider, TTSProvider } from '@suara/core';
import { assembleTurnDeps } from './compose';
import { createDb } from './db/client';
import { DrizzleLearnerStore } from './db/learnerStore';
import { DrizzlePendingTurnStore } from './db/pendingStore';
import { R2ObjectStore } from './storage/r2';
import type { TurnHandlerDeps } from './turn/handlers';

export interface ServerEnv {
  ANTHROPIC_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  SPEECHSUPER_APP_KEY?: string;
  SPEECHSUPER_SECRET?: string;
  DATABASE_URL?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
}

function required(env: ServerEnv, key: keyof ServerEnv): string {
  const v = env[key];
  if (!v) throw new Error(`${key} is required`);
  return v;
}

function buildTts(env: ServerEnv): TTSProvider {
  const store = new R2ObjectStore({
    accountId: required(env, 'R2_ACCOUNT_ID'),
    accessKeyId: required(env, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: required(env, 'R2_SECRET_ACCESS_KEY'),
    bucket: required(env, 'R2_BUCKET'),
    publicBaseUrl: required(env, 'R2_PUBLIC_BASE_URL'),
  });
  return new ElevenLabsTTSProvider({ apiKey: required(env, 'ELEVENLABS_API_KEY'), store });
}

function buildAsr(env: ServerEnv): ASRProvider {
  return new ScribeASRProvider({ apiKey: required(env, 'ELEVENLABS_API_KEY') });
}

function buildPronunciation(config: LanguageConfig, env: ServerEnv): PronunciationProvider {
  // Routed by MODE, never by language. coached needs no vendor; tone/segmental score.
  if (config.pronunciation.mode === 'coached') return new CoachedPronunciationProvider();
  // tone (cmn) + segmental (jpn/kor) via SpeechSuper. Azure (esp. hi-IN) lands next.
  return new SpeechSuperProvider({
    appKey: required(env, 'SPEECHSUPER_APP_KEY'),
    secretKey: required(env, 'SPEECHSUPER_SECRET'),
  });
}

export function createTurnHandlerDeps(
  config: LanguageConfig,
  env: ServerEnv,
  curriculumContext?: string,
): TurnHandlerDeps {
  const db = createDb(required(env, 'DATABASE_URL'));
  // `new Anthropic()` reads ANTHROPIC_API_KEY from the environment — no secret here.
  const client = new Anthropic() as unknown as AnthropicClientLike;
  const llm = new AnthropicProvider(
    curriculumContext === undefined ? { config, client } : { config, client, curriculumContext },
  );

  const deps = assembleTurnDeps({
    config,
    store: new DrizzleLearnerStore(db),
    llm,
    tts: buildTts(env),
    asr: buildAsr(env),
    pronunciation: buildPronunciation(config, env),
  });
  return { deps, pending: new DrizzlePendingTurnStore(db) };
}
