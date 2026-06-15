import { describe, expect, it } from 'vitest';
import type { FetchLike, HttpResponse } from '../http';
import { ElevenLabsTTSProvider, InMemoryObjectStore } from './elevenlabs';

function audioOk(): HttpResponse {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(3),
    text: async () => '',
    json: async () => ({}),
  };
}

describe('ElevenLabsTTSProvider', () => {
  it('synthesizes on a miss, caches in the store, and serves from cache on a hit', async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return audioOk();
    };
    const store = new InMemoryObjectStore();
    const tts = new ElevenLabsTTSProvider({ apiKey: 'k', store, fetch });

    const a = await tts.synth('我想喝茶', 'voiceA', 'cmn');
    expect(a.url).toContain('mem://audio/');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/text-to-speech/voiceA');
    expect(calls[0]!.url).toContain('output_format=');

    const b = await tts.synth('我想喝茶', 'voiceA', 'cmn');
    expect(b.cacheKey).toBe(a.cacheKey);
    expect(calls).toHaveLength(1); // cache hit -> no second vendor call
  });

  it('keys the cache on the voice (same text, new voice = new synth)', async () => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(url);
      return audioOk();
    };
    const tts = new ElevenLabsTTSProvider({ apiKey: 'k', store: new InMemoryObjectStore(), fetch });
    await tts.synth('hi', 'v1', 'cmn');
    await tts.synth('hi', 'v2', 'cmn');
    expect(calls).toHaveLength(2);
  });

  it('throws on a non-ok response', async () => {
    const fetch: FetchLike = async () => ({
      ok: false,
      status: 401,
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => 'bad key',
      json: async () => ({}),
    });
    const tts = new ElevenLabsTTSProvider({ apiKey: 'k', store: new InMemoryObjectStore(), fetch });
    await expect(tts.synth('x', 'v', 'cmn')).rejects.toThrow(/ElevenLabs TTS 401/);
  });
});
