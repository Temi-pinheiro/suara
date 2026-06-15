import { describe, expect, it } from 'vitest';
import type { AudioBlob } from '@suara/core';
import type { FetchLike, HttpRequestInit } from '../http';
import { SpeechSuperProvider, mapSpeechSuperResult } from './speechsuper';

const audio: AudioBlob = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/wav' };

describe('mapSpeechSuperResult', () => {
  it('maps overall + per-syllable tone scores', () => {
    const raw = {
      result: {
        overall: 82,
        words: [
          { word: '我', scores: { overall: 90 }, tone: { ref: '3', user: '3' } },
          { word: '茶', scores: { overall: 55 }, tone: { ref: '2', user: '1' } },
        ],
      },
    };
    const score = mapSpeechSuperResult(raw);
    expect(score.overall).toBe(82);
    expect(score.perSyllable).toHaveLength(2);
    expect(score.perSyllable[1]).toMatchObject({
      unit: '茶',
      score: 55,
      expectedTone: '2',
      producedTone: '1',
    });
  });

  it('tolerates a sparse / unexpected payload', () => {
    expect(mapSpeechSuperResult({}).overall).toBeNull();
    expect(mapSpeechSuperResult({}).perSyllable).toEqual([]);
    expect(mapSpeechSuperResult(null).overall).toBeNull();
  });
});

describe('SpeechSuperProvider', () => {
  it('posts to the coreType endpoint with a signed params form and maps the result', async () => {
    let captured: { url: string; init: HttpRequestInit } | null = null;
    const fetch: FetchLike = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
        json: async () => ({ result: { overall: 90, words: [{ word: '我', scores: { overall: 90 } }] } }),
      };
    };
    const provider = new SpeechSuperProvider({ appKey: 'a', secretKey: 's', fetch, coreType: 'sent.eval.cn' });

    const score = await provider.score(audio, '我', 'cmn');
    expect(score.overall).toBe(90);
    expect(score.perSyllable[0]?.unit).toBe('我');
    expect(captured!.url).toContain('/sent.eval.cn');
    expect(captured!.init.body).toBeInstanceOf(FormData);
  });

  it('throws on a non-ok response', async () => {
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 403,
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => 'forbidden',
      json: async () => ({}),
    });
    const provider = new SpeechSuperProvider({ appKey: 'a', secretKey: 's', fetch });
    await expect(provider.score(audio, '我', 'cmn')).rejects.toThrow(/SpeechSuper 403/);
  });
});
