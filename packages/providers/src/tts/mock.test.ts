import { describe, expect, it } from 'vitest';
import { MockTTSProvider, contentHash } from './mock';

describe('MockTTSProvider — cost-discipline cache (CLAUDE.md §6)', () => {
  it('caches by (text, voiceId) hash: a repeated line is synthesized once', async () => {
    const tts = new MockTTSProvider();
    const a = await tts.synth('我想喝茶', 'cmn-native', 'cmn');
    const b = await tts.synth('我想喝茶', 'cmn-native', 'cmn');

    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a).toBe(b); // same cached AudioRef
    expect(tts.synthCount).toBe(1);
    expect(tts.cacheHits).toBe(1);
  });

  it('keys on the voice too: the same text in another voice is a new synth', async () => {
    const tts = new MockTTSProvider();
    await tts.synth('我想喝茶', 'cmn-native', 'cmn');
    await tts.synth('我想喝茶', 'eng-warm', 'cmn');

    expect(tts.synthCount).toBe(2);
    expect(tts.cacheHits).toBe(0);
  });

  it('contentHash is stable and voice-sensitive', () => {
    expect(contentHash('茶', 'v1')).toBe(contentHash('茶', 'v1'));
    expect(contentHash('茶', 'v1')).not.toBe(contentHash('茶', 'v2'));
  });
});
