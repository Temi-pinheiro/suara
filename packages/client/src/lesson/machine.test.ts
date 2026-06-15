import { describe, expect, it } from 'vitest';
import {
  canSpeak,
  initialLessonState,
  lessonReducer,
  type LessonEvent,
  type LessonState,
} from './machine';
import type { AttemptResult, PromptPacket } from '../api/types';

const prompt: PromptPacket = {
  turnId: 't1',
  englishSetup: 'How would you say: I want coffee? Take your time.',
  setupAudioUrl: 'mock://setup/t1',
  targetUtterance: { surface: '我要咖啡', pinyin: 'wǒ yào kāfēi', expectedTones: '3-4-1-1' },
};

const advance: AttemptResult = {
  verdict: 'correct',
  correction: 'Lovely and clear.',
  modelAudioUrl: 'mock://model/t1',
  decision: 'advance',
};

const rebuild: AttemptResult = {
  verdict: 'close',
  correction: 'So close — let the last word rise.',
  modelAudioUrl: 'mock://model/t1',
  decision: 'rebuild',
  toneFocus: '2',
};

function run(events: LessonEvent[], start: LessonState = initialLessonState): LessonState {
  return events.reduce(lessonReducer, start);
}

describe('lessonReducer — happy path (construct → score → model → advance)', () => {
  it('walks load → prompt → awaiting → record → score → feedback → next load', () => {
    const states: LessonState[] = [];
    let s = initialLessonState;
    for (const e of [
      { type: 'LOAD' },
      { type: 'PROMPT_READY', prompt },
      { type: 'PROMPT_PLAYED' },
      { type: 'START_RECORDING' },
      { type: 'SUBMIT', audio: { uri: 'mock://rec', mimeType: 'audio/mock' } },
      { type: 'SCORED', result: advance },
      { type: 'FEEDBACK_PLAYED' },
    ] satisfies LessonEvent[]) {
      s = lessonReducer(s, e);
      states.push(s);
    }
    expect(states.map((x) => x.phase)).toEqual([
      'loading',
      'prompting',
      'awaiting',
      'recording',
      'scoring',
      'feedback',
      'loading', // advance -> fetch the next turn
    ]);
  });

  it('only lets the learner speak while awaiting (self-paced, no timer)', () => {
    expect(canSpeak({ ...initialLessonState, phase: 'awaiting' })).toBe(true);
    expect(canSpeak({ ...initialLessonState, phase: 'prompting' })).toBe(false);
    expect(canSpeak({ ...initialLessonState, phase: 'recording' })).toBe(false);
  });
});

describe('lessonReducer — rebuild loops back to the same prompt', () => {
  it('returns to awaiting (not loading) on a rebuild decision', () => {
    const s = run([
      { type: 'LOAD' },
      { type: 'PROMPT_READY', prompt },
      { type: 'PROMPT_PLAYED' },
      { type: 'START_RECORDING' },
      { type: 'SUBMIT', audio: { uri: 'mock://rec', mimeType: 'audio/mock' } },
      { type: 'SCORED', result: rebuild },
      { type: 'FEEDBACK_PLAYED' },
    ]);
    expect(s.phase).toBe('awaiting');
    expect(s.prompt?.turnId).toBe('t1'); // same prompt retained
    expect(s.attempt).toBeNull();
  });
});

describe('lessonReducer — guards and errors', () => {
  it('ignores out-of-phase events', () => {
    // START_RECORDING is a no-op unless awaiting
    const s = lessonReducer({ ...initialLessonState, phase: 'loading' }, { type: 'START_RECORDING' });
    expect(s.phase).toBe('loading');
  });

  it('captures failures', () => {
    const s = lessonReducer(initialLessonState, { type: 'FAIL', error: 'network' });
    expect(s.phase).toBe('error');
    expect(s.error).toBe('network');
  });
});
