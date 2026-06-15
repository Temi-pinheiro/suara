/**
 * ScribeASRProvider — ElevenLabs Scribe speech-to-text ("what did the learner say").
 *
 * API: POST https://api.elevenlabs.io/v1/speech-to-text, header xi-api-key,
 *      multipart/form-data { model_id, language_code, file }, response { text, ... }.
 * Transport injected for CI (no live calls).
 */

import type { ASRProvider, AudioBlob, LangCode } from '@suara/core';
import { defaultFetch, type FetchLike } from '../http';

/** Suara LangCode -> ISO-639-1 (Scribe accepts ISO-639-1 or -3). */
const ISO_639_1: Record<LangCode, string> = {
  cmn: 'zh',
  jpn: 'ja',
  kor: 'ko',
  ind: 'id',
  hin: 'hi',
};

export interface ScribeOptions {
  apiKey: string;
  fetch?: FetchLike;
  /** 'scribe_v1' (default) or 'scribe_v2' */
  modelId?: string;
  baseUrl?: string;
}

export class ScribeASRProvider implements ASRProvider {
  private readonly apiKey: string;
  private readonly fetch: FetchLike;
  private readonly modelId: string;
  private readonly baseUrl: string;

  constructor(opts: ScribeOptions) {
    this.apiKey = opts.apiKey;
    this.fetch = opts.fetch ?? defaultFetch;
    this.modelId = opts.modelId ?? 'scribe_v1';
    this.baseUrl = opts.baseUrl ?? 'https://api.elevenlabs.io';
  }

  async transcribe(audio: AudioBlob, lang: LangCode): Promise<{ text: string }> {
    const form = new FormData();
    form.append('model_id', this.modelId);
    form.append('language_code', ISO_639_1[lang]);
    form.append('file', new Blob([audio.bytes], { type: audio.mimeType }), 'audio');

    const res = await this.fetch(`${this.baseUrl}/v1/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs Scribe ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as { text?: string };
    return { text: json.text ?? '' };
  }
}
