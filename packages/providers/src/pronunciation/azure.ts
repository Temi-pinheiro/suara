/**
 * AzureProvider — pronunciation scoring via Azure AI Speech "Pronunciation
 * Assessment" (short-audio REST). Self-serve keys (no waiting), so it's the
 * immediate scorer for Mandarin `tone` and the `segmental` languages (jp/ko/hi).
 *
 * API: POST https://{region}.stt.speech.microsoft.com/speech/recognition/
 *        conversation/cognitiveservices/v1?language={locale}&format=detailed
 *      headers: Ocp-Apim-Subscription-Key, Content-Type audio/wav;...;samplerate=16000,
 *               Pronunciation-Assessment: base64(JSON config), Accept application/json
 *      body: WAV PCM 16kHz mono audio.
 *
 * Azure reports per-syllable ACCURACY (not an explicit tone number); the brain
 * coaches the tone contour from low-scoring syllables + the model audio. Transport
 * injected for CI (no live calls). Response mapping is isolated + tested.
 */

import type { AudioBlob, LangCode, PerUnitScore, PronScore, PronunciationProvider } from '@suara/core';
import { defaultFetch, type FetchLike } from '../http';

const LOCALE: Partial<Record<LangCode, string>> = {
  cmn: 'zh-CN',
  jpn: 'ja-JP',
  kor: 'ko-KR',
  hin: 'hi-IN',
  ind: 'id-ID',
};

export interface AzureProviderOptions {
  speechKey: string;
  region: string;
  fetch?: FetchLike;
  /** override the endpoint (e.g. a custom-subdomain resource host) */
  baseUrl?: string;
  granularity?: 'Phoneme' | 'Word' | 'FullText';
  enableProsody?: boolean;
  /** override the recognition locale; else derived from the lang */
  locale?: string;
}

export class AzureProvider implements PronunciationProvider {
  private readonly speechKey: string;
  private readonly region: string;
  private readonly fetch: FetchLike;
  private readonly baseUrl: string | undefined;
  private readonly granularity: 'Phoneme' | 'Word' | 'FullText';
  private readonly enableProsody: boolean;
  private readonly localeOverride: string | undefined;

  constructor(opts: AzureProviderOptions) {
    this.speechKey = opts.speechKey;
    this.region = opts.region;
    this.fetch = opts.fetch ?? defaultFetch;
    this.baseUrl = opts.baseUrl;
    this.granularity = opts.granularity ?? 'Phoneme';
    this.enableProsody = opts.enableProsody ?? false;
    this.localeOverride = opts.locale;
  }

  async score(audio: AudioBlob, referenceText: string, lang: LangCode): Promise<PronScore> {
    const locale = this.localeOverride ?? LOCALE[lang] ?? 'zh-CN';

    const config: Record<string, string> = {
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: this.granularity,
      Dimension: 'Comprehensive',
      EnableMiscue: 'False',
    };
    if (this.enableProsody) config.EnableProsodyAssessment = 'True';
    const assessmentHeader = Buffer.from(JSON.stringify(config), 'utf8').toString('base64');

    const base = this.baseUrl ?? `https://${this.region}.stt.speech.microsoft.com`;
    const url = `${base}/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`;

    const res = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.speechKey,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json',
        'Pronunciation-Assessment': assessmentHeader,
      },
      body: audio.bytes,
    });
    if (!res.ok) {
      throw new Error(`Azure pronunciation ${res.status}: ${await res.text()}`);
    }
    return mapAzureResult(await res.json());
  }
}

/**
 * Map an Azure detailed pronunciation-assessment result into our PronScore.
 * Prefers per-syllable accuracy (richest for zh-CN), falling back to word-level.
 * Defensive + exported so it can be tuned to a live payload in isolation.
 */
export function mapAzureResult(raw: unknown): PronScore {
  const root = isRecord(raw) ? raw : {};
  const nbest = Array.isArray(root.NBest) ? root.NBest : [];
  const best = isRecord(nbest[0]) ? nbest[0] : {};

  const overall = num(best.PronScore) ?? num(best.AccuracyScore);

  const perSyllable: PerUnitScore[] = [];
  const words = Array.isArray(best.Words) ? best.Words : [];
  for (const w of words) {
    const word = isRecord(w) ? w : {};
    const syllables = Array.isArray(word.Syllables) ? word.Syllables : [];
    if (syllables.length > 0) {
      for (const s of syllables) {
        const syl = isRecord(s) ? s : {};
        perSyllable.push({
          unit: str(syl.Syllable) ?? str(syl.Grapheme) ?? '',
          score: accuracyOf(syl) ?? 0,
        });
      }
    } else {
      perSyllable.push({ unit: str(word.Word) ?? '', score: accuracyOf(word) ?? 0 });
    }
  }

  return { overall, perSyllable };
}

/** AccuracyScore is sometimes flat, sometimes nested under PronunciationAssessment. */
function accuracyOf(o: Record<string, unknown>): number | null {
  const direct = num(o.AccuracyScore);
  if (direct !== null) return direct;
  const pa = isRecord(o.PronunciationAssessment) ? o.PronunciationAssessment : {};
  return num(pa.AccuracyScore);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function num(x: unknown): number | null {
  return typeof x === 'number' ? x : null;
}
function str(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}
