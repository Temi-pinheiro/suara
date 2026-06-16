import { describe, expect, it } from 'vitest';
import type { AudioBlob } from '@suara/core';
import type { FetchLike, HttpRequestInit } from '../http';
import { AzureProvider, mapAzureResult } from './azure';

const audio: AudioBlob = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/wav' };

describe('mapAzureResult', () => {
  it('maps PronScore + per-syllable accuracy (zh-CN)', () => {
    const raw = {
      RecognitionStatus: 'Success',
      NBest: [
        {
          PronScore: 82,
          AccuracyScore: 80,
          Words: [
            { Word: '我', Syllables: [{ Syllable: 'wo3', AccuracyScore: 90 }] },
            { Word: '茶', Syllables: [{ Syllable: 'cha2', AccuracyScore: 55 }] },
          ],
        },
      ],
    };
    const score = mapAzureResult(raw);
    expect(score.overall).toBe(82);
    expect(score.perSyllable).toEqual([
      { unit: 'wo3', score: 90 },
      { unit: 'cha2', score: 55 },
    ]);
  });

  it('falls back to word-level accuracy when there are no syllables', () => {
    const raw = { NBest: [{ PronScore: 70, Words: [{ Word: 'good', AccuracyScore: 70 }] }] };
    expect(mapAzureResult(raw).perSyllable).toEqual([{ unit: 'good', score: 70 }]);
  });

  it('tolerates a sparse / unexpected payload', () => {
    expect(mapAzureResult({}).overall).toBeNull();
    expect(mapAzureResult({}).perSyllable).toEqual([]);
    expect(mapAzureResult(null).overall).toBeNull();
  });
});

describe('AzureProvider', () => {
  it('posts to the regional endpoint with the base64 assessment header and maps the result', async () => {
    let captured: { url: string; init: HttpRequestInit } | null = null;
    const fetch: FetchLike = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
        json: async () => ({ NBest: [{ PronScore: 91, Words: [{ Word: '我', AccuracyScore: 91 }] }] }),
      };
    };
    const provider = new AzureProvider({ speechKey: 'k', region: 'eastus', fetch });

    const score = await provider.score(audio, '我', 'cmn');
    expect(score.overall).toBe(91);
    expect(captured!.url).toContain('https://eastus.stt.speech.microsoft.com/');
    expect(captured!.url).toContain('language=zh-CN');
    expect(captured!.url).toContain('format=detailed');
    expect(captured!.init.headers?.['Ocp-Apim-Subscription-Key']).toBe('k');

    // the Pronunciation-Assessment header is base64 of the JSON config
    const header = captured!.init.headers?.['Pronunciation-Assessment'] ?? '';
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    expect(decoded.ReferenceText).toBe('我');
    expect(decoded.GradingSystem).toBe('HundredMark');
  });

  it('throws on a non-ok response', async () => {
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 401,
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => 'unauthorized',
      json: async () => ({}),
    });
    const provider = new AzureProvider({ speechKey: 'k', region: 'eastus', fetch });
    await expect(provider.score(audio, '我', 'cmn')).rejects.toThrow(/Azure pronunciation 401/);
  });
});
