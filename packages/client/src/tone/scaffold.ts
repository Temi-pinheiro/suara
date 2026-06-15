/**
 * Audio-native Mandarin tone scaffold (PLAN.md §2).
 *
 * MT's colour/gesture mnemonic is visual and doesn't transfer to an all-voice app.
 * The replacement, per tone: a spoken CONTOUR description, a consistent verbal
 * MNEMONIC, and a hint for an exaggerated SUNG model. This data drives the spoken
 * cue; the brain still delivers the in-lesson correction in its own words.
 */

export interface ToneCueData {
  /** '1'..'4' and '0' (neutral) */
  tone: string;
  name: string;
  /** plain-language spoken contour */
  contour: string;
  /** consistent one-image mnemonic, reused every time this tone appears */
  mnemonic: string;
  /** how to exaggerate the sung model */
  sungModelHint: string;
}

const SCAFFOLD: Record<string, ToneCueData> = {
  '1': {
    tone: '1',
    name: 'high & level',
    contour: 'Stay up high and hold it flat, like one steady note.',
    mnemonic: 'a held note',
    sungModelHint: 'Sing it long and even — no movement at all.',
  },
  '2': {
    tone: '2',
    name: 'rising',
    contour: 'Start lower and let it rise, like a gentle question.',
    mnemonic: 'a question',
    sungModelHint: 'Slide your voice upward toward the end.',
  },
  '3': {
    tone: '3',
    name: 'dip',
    contour: 'Dip down low first, then come back up.',
    mnemonic: 'a dip',
    sungModelHint: 'Drop into your chest, then lift back up.',
  },
  '4': {
    tone: '4',
    name: 'falling',
    contour: 'Drop sharply from high to low, like a firm "No!".',
    mnemonic: 'a firm no',
    sungModelHint: 'Start high and fall fast and clean.',
  },
  '0': {
    tone: '0',
    name: 'neutral',
    contour: 'Light and quick — no stress, just let it land softly.',
    mnemonic: 'a soft landing',
    sungModelHint: 'Say it short and relaxed, almost throwaway.',
  },
};

export const ALL_TONE_CUES: ToneCueData[] = Object.values(SCAFFOLD);

export function toneCue(tone: string): ToneCueData | undefined {
  return SCAFFOLD[tone];
}

/** Map an expected-tone string like "3-3-1-2" to a cue per syllable. */
export function toneCues(expectedTones: string): ToneCueData[] {
  return expectedTones
    .split('-')
    .map((t) => SCAFFOLD[t.trim()])
    .filter((c): c is ToneCueData => c !== undefined);
}
