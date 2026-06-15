/**
 * SpeechSuperProvider — Mandarin initial/final/TONE scoring (the one language that
 * needs true tone scoring). Implements PronunciationProvider; transport injected.
 *
 * API shape (verified structurally against SpeechSuper's samples):
 *   POST {baseUrl}/{coreType}  multipart/form-data { text: <params JSON>, audio: <file> }
 *   auth via SHA1 signatures:
 *     connectSig = sha1(appKey + timestamp + secretKey)
 *     startSig   = sha1(appKey + timestamp + userId + secretKey)
 *
 * NOTE: `coreType` and the exact result field names should be confirmed against your
 * SpeechSuper account/plan. `coreType` is configurable and the response mapping
 * (mapSpeechSuperResult) is defensive + independently tested, so tuning it to the
 * real payload is a localized change.
 */

import { createHash } from 'node:crypto';
import type { AudioBlob, LangCode, PerUnitScore, PronScore, PronunciationProvider } from '@suara/core';
import { defaultFetch, type FetchLike } from '../http';

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

export interface SpeechSuperOptions {
  appKey: string;
  secretKey: string;
  fetch?: FetchLike;
  baseUrl?: string;
  userId?: string;
  /** Mandarin sentence eval by default; swap per assessment grain/plan. */
  coreType?: string;
  sampleRate?: number;
  audioType?: string;
}

export class SpeechSuperProvider implements PronunciationProvider {
  private readonly appKey: string;
  private readonly secretKey: string;
  private readonly fetch: FetchLike;
  private readonly baseUrl: string;
  private readonly userId: string;
  private readonly coreType: string;
  private readonly sampleRate: number;
  private readonly audioType: string;

  constructor(opts: SpeechSuperOptions) {
    this.appKey = opts.appKey;
    this.secretKey = opts.secretKey;
    this.fetch = opts.fetch ?? defaultFetch;
    this.baseUrl = opts.baseUrl ?? 'https://api.speechsuper.com';
    this.userId = opts.userId ?? 'suara';
    this.coreType = opts.coreType ?? 'sent.eval.cn';
    this.sampleRate = opts.sampleRate ?? 16000;
    this.audioType = opts.audioType ?? 'wav';
  }

  private buildParams(referenceText: string): string {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const connectSig = sha1(this.appKey + timestamp + this.secretKey);
    const startSig = sha1(this.appKey + timestamp + this.userId + this.secretKey);
    return JSON.stringify({
      connect: {
        cmd: 'connect',
        param: {
          sdk: { version: 16777472, source: 9, protocol: 2 },
          app: { applicationId: this.appKey, sig: connectSig, timestamp },
        },
      },
      start: {
        cmd: 'start',
        param: {
          app: { userId: this.userId, applicationId: this.appKey, timestamp, sig: startSig },
          audio: { audioType: this.audioType, channel: 1, sampleBytes: 2, sampleRate: this.sampleRate },
          request: { coreType: this.coreType, refText: referenceText, tokenId: this.userId },
        },
      },
    });
  }

  async score(audio: AudioBlob, referenceText: string, _lang: LangCode): Promise<PronScore> {
    const form = new FormData();
    form.append('text', this.buildParams(referenceText));
    form.append('audio', new Blob([audio.bytes], { type: audio.mimeType }), 'audio');

    const res = await this.fetch(`${this.baseUrl}/${this.coreType}`, {
      method: 'POST',
      headers: { 'Request-Index': '0' },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`SpeechSuper ${res.status}: ${await res.text()}`);
    }
    return mapSpeechSuperResult(await res.json());
  }
}

/**
 * Map a SpeechSuper result into our PronScore. Defensive: reads the common
 * `result.overall` + per-word/char entries with tone fields, tolerating absent
 * fields. Exported + tested so it can be tuned to the live payload in isolation.
 */
export function mapSpeechSuperResult(raw: unknown): PronScore {
  const root = isRecord(raw) ? raw : {};
  const result = isRecord(root.result) ? root.result : root;

  const overall = num(result.overall);

  const wordsRaw = Array.isArray(result.words)
    ? result.words
    : Array.isArray(result.details)
      ? result.details
      : [];

  const perSyllable: PerUnitScore[] = wordsRaw.map((w): PerUnitScore => {
    const word = isRecord(w) ? w : {};
    const scores = isRecord(word.scores) ? word.scores : word;
    const tone = isRecord(word.tone) ? word.tone : {};
    const entry: PerUnitScore = {
      unit: str(word.word) ?? str(word.char) ?? str(word.text) ?? '',
      score: num(scores.overall) ?? num(word.overall) ?? 0,
    };
    const expectedTone = str(tone.ref) ?? str(tone.expect) ?? str(word.refTone);
    const producedTone = str(tone.user) ?? str(tone.output) ?? str(word.tone);
    if (expectedTone !== undefined) entry.expectedTone = expectedTone;
    if (producedTone !== undefined) entry.producedTone = producedTone;
    return entry;
  });

  return { overall, perSyllable, tone: perSyllable };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function num(x: unknown): number | null {
  return typeof x === 'number' ? x : null;
}
function str(x: unknown): string | undefined {
  return typeof x === 'string' ? x : typeof x === 'number' ? String(x) : undefined;
}
