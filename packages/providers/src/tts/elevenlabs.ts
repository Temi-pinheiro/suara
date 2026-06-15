/**
 * ElevenLabsTTSProvider — real TTS with a shared content-hash cache.
 *
 * synth() checks the ObjectStore first (cache hit → just return the URL); on a miss
 * it calls ElevenLabs, stores the audio, and returns the URL. The store is injected
 * (R2 in prod, in-memory in tests); the HTTP transport is injected too, so this runs
 * in CI with no live calls. Caching by (voiceId, text) is the cost lever (CLAUDE.md §8).
 *
 * API: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=...
 *      header xi-api-key; JSON body { text, model_id }; response is binary audio.
 */

import type { AudioRef, LangCode, TTSProvider } from '@suara/core';
import { defaultFetch, type FetchLike } from '../http';
import { contentHash } from './hash';

/** Where synthesized audio is cached + served from. R2 in prod (zero egress). */
export interface ObjectStore {
  exists(key: string): Promise<boolean>;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  url(key: string): string;
}

/** In-memory ObjectStore for dev + tests. */
export class InMemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, Uint8Array>();

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(key, bytes);
  }
  url(key: string): string {
    return `mem://audio/${key}`;
  }
}

export interface ElevenLabsTTSOptions {
  apiKey: string;
  store: ObjectStore;
  fetch?: FetchLike;
  /** default 'eleven_multilingual_v2' (covers all five Suara languages) */
  modelId?: string;
  /** default 'mp3_44100_128' */
  outputFormat?: string;
  baseUrl?: string;
}

export class ElevenLabsTTSProvider implements TTSProvider {
  private readonly apiKey: string;
  private readonly store: ObjectStore;
  private readonly fetch: FetchLike;
  private readonly modelId: string;
  private readonly outputFormat: string;
  private readonly baseUrl: string;

  constructor(opts: ElevenLabsTTSOptions) {
    this.apiKey = opts.apiKey;
    this.store = opts.store;
    this.fetch = opts.fetch ?? defaultFetch;
    this.modelId = opts.modelId ?? 'eleven_multilingual_v2';
    this.outputFormat = opts.outputFormat ?? 'mp3_44100_128';
    this.baseUrl = opts.baseUrl ?? 'https://api.elevenlabs.io';
  }

  async synth(text: string, voiceId: string, lang: LangCode): Promise<AudioRef> {
    const cacheKey = contentHash(text, voiceId);

    if (await this.store.exists(cacheKey)) {
      return { cacheKey, text, voiceId, lang, url: this.store.url(cacheKey) };
    }

    const url = `${this.baseUrl}/v1/text-to-speech/${voiceId}?output_format=${this.outputFormat}`;
    const res = await this.fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: this.modelId }),
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    await this.store.put(cacheKey, bytes, 'audio/mpeg');
    return { cacheKey, text, voiceId, lang, url: this.store.url(cacheKey) };
  }
}
