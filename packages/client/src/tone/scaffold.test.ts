import { describe, expect, it } from 'vitest';
import { ALL_TONE_CUES, toneCue, toneCues } from './scaffold';

describe('Mandarin tone scaffold (audio-native)', () => {
  it('covers all four tones plus neutral', () => {
    expect(ALL_TONE_CUES.map((c) => c.tone).sort()).toEqual(['0', '1', '2', '3', '4']);
  });

  it('gives each tone a contour, mnemonic, and sung-model hint', () => {
    for (const cue of ALL_TONE_CUES) {
      expect(cue.contour.length).toBeGreaterThan(0);
      expect(cue.mnemonic.length).toBeGreaterThan(0);
      expect(cue.sungModelHint.length).toBeGreaterThan(0);
    }
  });

  it('looks up a single tone', () => {
    expect(toneCue('2')?.name).toBe('rising');
    expect(toneCue('9')).toBeUndefined();
  });

  it('expands an expected-tone string into per-syllable cues', () => {
    const cues = toneCues('3-3-1-2'); // 我想喝茶
    expect(cues).toHaveLength(4);
    expect(cues.map((c) => c.tone)).toEqual(['3', '3', '1', '2']);
  });

  it('never surfaces a score or a memorization prompt', () => {
    const text = ALL_TONE_CUES.map((c) => `${c.contour} ${c.mnemonic} ${c.sungModelHint}`)
      .join(' ')
      .toLowerCase();
    for (const banned of ['score', 'remember', 'memorize', 'memorise', 'quiz']) {
      expect(text).not.toContain(banned);
    }
  });
});
