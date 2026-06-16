import { describe, expect, it } from 'vitest';
import { assertFeedback, assertTurnDecision } from './schema';

describe('assertFeedback', () => {
  it('drops masteryDelta entries the brain malforms (e.g. an invalid change)', () => {
    const fb = assertFeedback({
      verdict: 'correct',
      spokenModel: '我',
      correction: 'nicely balanced',
      decision: 'advance',
      masteryDelta: [
        { componentId: 'c01', change: 'strengthen' },
        { componentId: 'c02', change: 'increase' }, // invalid enum -> dropped
        { logError: { unit: 'wo', expected: '3', produced: '2' } },
        { bogus: true }, // malformed -> dropped
      ],
      nextPrompt: null,
      revealNote: null,
    });
    expect(fb.masteryDelta).toEqual([
      { componentId: 'c01', change: 'strengthen' },
      { logError: { unit: 'wo', expected: '3', produced: '2' } },
    ]);
  });

  it('rejects a bad verdict', () => {
    expect(() =>
      assertFeedback({ verdict: 'nope', spokenModel: 'x', correction: 'x', decision: 'advance', masteryDelta: [] }),
    ).toThrow();
  });
});

describe('assertTurnDecision', () => {
  it('parses a valid decision and defaults optional fields', () => {
    const d = assertTurnDecision({
      action: 'introduce',
      focusComponentId: 'c01',
      recombinedComponentIds: [],
      englishSetup: 'How would you say: I?',
      targetUtterance: { surface: '我' },
      referenceText: '我',
      teachingNote: 'the subject slot',
    });
    expect(d.focusComponentId).toBe('c01');
    expect(d.classmateAttempt).toBeNull();
    expect(d.reassurance).toBeNull();
  });
});
