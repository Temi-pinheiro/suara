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
import type { ASRProvider, LangCode, LanguageConfig, PronunciationProvider, TTSProvider } from '@suara/core';
import { assembleTurnDeps } from './compose';
import { isSupportedLang, languageConfig, type VoiceIds } from './config/languages';
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

/**
 * Resolves TurnHandlerDeps by language for runtime language switching (the picker).
 * Shared infra — one DB, one Anthropic client, one TTS/ASR — is built once; only the
 * config, brain, pronunciation provider and (in-process) curriculum graph vary per
 * language. Per-language deps are built lazily and cached. Routing stays by
 * LanguageConfig/mode, never `if (lang === ...)`.
 */
export interface LanguageRouter {
  resolve(lang: string | undefined): TurnHandlerDeps;
}

export function createLanguageRouter(
  env: ServerEnv,
  voices: VoiceIds,
  opts: { defaultLang?: LangCode } = {},
): LanguageRouter {
  const db = createDb(required(env, 'DATABASE_URL'));
  const client = new Anthropic() as unknown as AnthropicClientLike;
  const tts = buildTts(env);
  const asr = buildAsr(env);
  const store = new DrizzleLearnerStore(db);
  const pending = new DrizzlePendingTurnStore(db); // shared: keyed by turnId, not language
  const defaultLang: LangCode = opts.defaultLang ?? 'cmn';
  const cache = new Map<LangCode, TurnHandlerDeps>();

  function build(lang: LangCode): TurnHandlerDeps {
    const config = languageConfig(lang, voices);
    const deps = assembleTurnDeps({
      config,
      store,
      llm: new AnthropicProvider({ config, client }),
      tts,
      asr,
      pronunciation: buildPronunciation(config, env),
    });
    return { deps, pending };
  }

  return {
    resolve(lang) {
      const code: LangCode = lang && isSupportedLang(lang) ? lang : defaultLang;
      let h = cache.get(code);
      if (!h) {
        h = build(code);
        cache.set(code, h);
      }
      return h;
    },
  };
}
