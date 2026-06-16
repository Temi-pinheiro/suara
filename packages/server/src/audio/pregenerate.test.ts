import { describe, expect, it } from 'vitest';
import { loadComponents } from '@suara/curriculum';
import { MockTTSProvider } from '@suara/providers';
import type { LanguageConfig } from '@suara/core';
import { pregenerateComponentAudio } from './pregenerate';

const config: LanguageConfig = {
  code: 'cmn',
  l1: 'eng',
  phonology: 'tonal',
  toneInventory: ['1', '2', '3', '4', '0'],
  tts: { provider: 'mock', targetVoiceId: 'cmn-native', l1VoiceId: 'eng-warm' },
  pronunciation: { mode: 'tone', provider: 'mock' },
};

describe('pregenerateComponentAudio', () => {
  it('synthesizes each component surface (romanization stripped) and returns urls', async () => {
    const tts = new MockTTSProvider();
    const components = loadComponents('cmn');

    const results = await pregenerateComponentAudio({ components, tts, config });

    expect(results).toHaveLength(components.length);
    for (const r of results) {
      expect(r.introAudioUrl).toContain('mock://audio/');
      expect(r.text).not.toContain('('); // pinyin parenthetical stripped
    }
    // first component is c01 我 (wǒ) -> '我'
    expect(results[0]).toMatchObject({ componentId: 'c01', text: '我' });
    expect(tts.synthCount).toBe(components.length); // all distinct
  });

  it('is idempotent — a second run is served entirely from the cache', async () => {
    const tts = new MockTTSProvider();
    const components = loadComponents('cmn');

    await pregenerateComponentAudio({ components, tts, config });
    const synthsAfterFirst = tts.synthCount;
    await pregenerateComponentAudio({ components, tts, config });

    expect(tts.synthCount).toBe(synthsAfterFirst); // no new vendor calls
    expect(tts.cacheHits).toBe(components.length); // every line a cache hit
  });
});
