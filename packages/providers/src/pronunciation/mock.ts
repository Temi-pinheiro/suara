import type {
  AudioBlob,
  LangCode,
  PronScore,
  PronunciationProvider,
} from '@suara/core';

export interface MockPronunciationOptions {
  /** returned for every call unless a per-reference override matches */
  default?: PronScore;
  /** keyed by referenceText, for scripting specific misses in tests */
  byReference?: Record<string, PronScore>;
}

/**
 * Mock pronunciation scorer (tone/segmental modes). By default returns a clean,
 * high score derived from the reference; tests can script a tone miss per
 * reference to exercise the rebuild path.
 */
export class MockPronunciationProvider implements PronunciationProvider {
  public callCount = 0;

  constructor(private readonly opts: MockPronunciationOptions = {}) {}

  async score(_audio: AudioBlob, referenceText: string, _lang: LangCode): Promise<PronScore> {
    this.callCount += 1;
    const seeded = this.opts.byReference?.[referenceText];
    if (seeded) return seeded;
    if (this.opts.default) return this.opts.default;
    const units = [...referenceText];
    return {
      overall: 92,
      perSyllable: units.map((u) => ({ unit: u, score: 92 })),
    };
  }
}
