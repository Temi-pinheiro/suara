import { createHash } from 'node:crypto';
import type { AudioRef, LangCode, TTSProvider } from '@suara/core';

export function contentHash(text: string, voiceId: string): string {
  return createHash('sha256').update(`${voiceId}::${text}`).digest('hex').slice(0, 16);
}

/**
 * Mock TTS that honors the cost rule: cache by (text, voiceId) hash. Teacher lines
 * are highly reusable, so cache hits should dominate. Exposes counters so tests can
 * assert the caching actually fires.
 */
export class MockTTSProvider implements TTSProvider {
  private readonly cache = new Map<string, AudioRef>();
  public synthCount = 0;
  public cacheHits = 0;

  async synth(text: string, voiceId: string, lang: LangCode): Promise<AudioRef> {
    const cacheKey = contentHash(text, voiceId);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits += 1;
      return cached;
    }
    this.synthCount += 1;
    const ref: AudioRef = {
      cacheKey,
      text,
      voiceId,
      lang,
      url: `mock://audio/${cacheKey}`,
      durationMs: Math.max(400, text.length * 60),
    };
    this.cache.set(cacheKey, ref);
    return ref;
  }
}
