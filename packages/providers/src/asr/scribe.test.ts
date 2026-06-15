import { describe, expect, it } from 'vitest';
import type { AudioBlob } from '@suara/core';
import type { FetchLike, HttpRequestInit } from '../http';
import { ScribeASRProvider } from './scribe';

const audio: AudioBlob = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/wav' };

describe('ScribeASRProvider', () => {
  it('transcribes via the Scribe endpoint with the api key + form upload', async () => {
    let captured: { url: string; init: HttpRequestInit } | null = null;
    const fetch: FetchLike = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => '',
        json: async () => ({ text: '我', language_code: 'zh' }),
      };
    };
    const asr = new ScribeASRProvider({ apiKey: 'k', fetch });

    const { text } = await asr.transcribe(audio, 'cmn');
    expect(text).toBe('我');
    expect(captured!.url).toContain('/v1/speech-to-text');
    expect(captured!.init.headers?.['xi-api-key']).toBe('k');
    expect(captured!.init.body).toBeInstanceOf(FormData);
  });

  it('throws on a non-ok response', async () => {
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 500,
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => 'server error',
      json: async () => ({}),
    });
    const asr = new ScribeASRProvider({ apiKey: 'k', fetch });
    await expect(asr.transcribe(audio, 'cmn')).rejects.toThrow(/Scribe 500/);
  });
});
