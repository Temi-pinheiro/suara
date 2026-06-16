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
  AzureProvider,
  CoachedPronunciationProvider,
  ElevenLabsTTSProvider,
  ScribeASRProvider,
  SpeechSuperProvider,
  type AnthropicClientLike,
  type AnthropicProviderOptions,
} from '@suara/providers';
import type { ASRProvider, LanguageConfig, PronunciationProvider, TTSProvider } from '@suara/core';
import { assembleTurnDeps } from './compose';
import { MeteredASRProvider, MeteredPronunciationProvider, MeteredTTSProvider, type UsageMeter } from './cost/meter';
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
  AZURE_SPEECH_KEY?: string;
  AZURE_REGION?: string;
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
  // Routed by MODE (never by language); within a scored mode, the concrete vendor is
  // chosen by config.pronunciation.provider — so picking Azure (self-serve) vs
  // SpeechSuper is a config change, zero core diffs.
  if (config.pronunciation.mode === 'coached') return new CoachedPronunciationProvider();

  if (config.pronunciation.provider === 'azure') {
    return new AzureProvider({
      speechKey: required(env, 'AZURE_SPEECH_KEY'),
      region: required(env, 'AZURE_REGION'),
    });
  }
  // Default scored vendor: SpeechSuper (richest tone detail for zh-CN).
  return new SpeechSuperProvider({
    appKey: required(env, 'SPEECHSUPER_APP_KEY'),
    secretKey: required(env, 'SPEECHSUPER_SECRET'),
  });
}

export interface CreateTurnHandlerOptions {
  curriculumContext?: string;
  /** when set, wraps the providers + brain so per-turn usage is tallied */
  meter?: UsageMeter;
}

export function createTurnHandlerDeps(
  config: LanguageConfig,
  env: ServerEnv,
  opts: CreateTurnHandlerOptions = {},
): TurnHandlerDeps {
  const db = createDb(required(env, 'DATABASE_URL'));
  // `new Anthropic()` reads ANTHROPIC_API_KEY from the environment — no secret here.
  const client = new Anthropic() as unknown as AnthropicClientLike;

  const meter = opts.meter;
  const llmOpts: AnthropicProviderOptions = { config, client };
  if (opts.curriculumContext !== undefined) llmOpts.curriculumContext = opts.curriculumContext;
  if (meter) {
    llmOpts.onUsage = (model, usage) =>
      meter.llm(model, {
        input: usage?.input_tokens,
        output: usage?.output_tokens,
        cacheRead: usage?.cache_read_input_tokens,
      });
  }

  const tts = meter ? new MeteredTTSProvider(buildTts(env), meter) : buildTts(env);
  const asr = meter ? new MeteredASRProvider(buildAsr(env), meter) : buildAsr(env);
  const pron = buildPronunciation(config, env);

  const deps = assembleTurnDeps({
    config,
    store: new DrizzleLearnerStore(db),
    llm: new AnthropicProvider(llmOpts),
    tts,
    asr,
    pronunciation: meter ? new MeteredPronunciationProvider(pron, meter) : pron,
  });
  return { deps, pending: new DrizzlePendingTurnStore(db) };
}
