import type {
  AudioBlob,
  LangCode,
  PronScore,
  PronunciationProvider,
} from '@suara/core';

/**
 * The `coached` no-op scorer (Indonesian). Returns null fields — there is no
 * scoring vendor. The turn lifecycle never even calls this in coached mode (the
 * orchestrator short-circuits); it exists to satisfy the interface and make the
 * "no scorer" path explicit. The brain supplies qualitative feedback instead.
 */
export class CoachedPronunciationProvider implements PronunciationProvider {
  public callCount = 0;

  async score(_audio: AudioBlob, _referenceText: string, _lang: LangCode): Promise<PronScore> {
    this.callCount += 1;
    return { overall: null, perSyllable: [], tone: null };
  }
}
