import { describe, expect, it } from 'vitest';
import {
  applyChange,
  applyTurnOutcome,
  dueIntervalMs,
  isDue,
  selectDueTargets,
} from './index';
import type { LearnerState } from '../types';

const NOW = 1_700_000_000_000;

function baseState(over: Partial<LearnerState> = {}): LearnerState {
  return { userId: 'u', lang: 'cmn', known: [], mastery: {}, turnIndex: 0, lastTurns: [], ...over };
}

describe('srs scheduling', () => {
  it('expands the interval as strength grows (never shrinks)', () => {
    expect(dueIntervalMs(1)).toBeGreaterThan(dueIntervalMs(0.5));
    expect(dueIntervalMs(0.5)).toBeGreaterThan(dueIntervalMs(0));
  });

  it('strengthening raises strength and schedules the next due in the future', () => {
    const rec = applyChange(undefined, 'c01', 'strengthen', NOW);
    expect(rec.strength).toBeGreaterThan(0);
    expect(rec.dueAt).toBeGreaterThan(NOW);
    expect(isDue(rec, NOW)).toBe(false);
  });

  it('weakening cannot drive strength below zero', () => {
    const rec = applyChange({ componentId: 'c01', strength: 0.1, lastSeen: 0, dueAt: 0 }, 'c01', 'weaken', NOW);
    expect(rec.strength).toBe(0);
  });
});

describe('applyTurnOutcome', () => {
  it('advance marks the focus known and bumps the turn counter', () => {
    const next = applyTurnOutcome(
      baseState(),
      { focusComponentId: 'c01', masteryDelta: [{ componentId: 'c01', change: 'strengthen' }], outcome: 'advance' },
      NOW,
    );
    expect(next.known).toContain('c01');
    expect(next.turnIndex).toBe(1);
    expect(next.mastery.c01?.strength).toBeGreaterThan(0);
  });

  it('rebuild keeps the focus OUT of known (retry next turn)', () => {
    const next = applyTurnOutcome(
      baseState(),
      { focusComponentId: 'c01', masteryDelta: [{ componentId: 'c01', change: 'partial' }], outcome: 'rebuild' },
      NOW,
    );
    expect(next.known).not.toContain('c01');
    expect(next.turnIndex).toBe(1);
  });

  it('ignores logError deltas for strength but advances normally', () => {
    const next = applyTurnOutcome(
      baseState(),
      {
        focusComponentId: 'c01',
        masteryDelta: [{ logError: { unit: 'wǒ', expected: '3', produced: '2' } }],
        outcome: 'advance',
      },
      NOW,
    );
    // focus still gets a default touch even though only an error delta was supplied
    expect(next.mastery.c01).toBeDefined();
    expect(next.known).toContain('c01');
  });
});

describe('selectDueTargets (the only SRS surface)', () => {
  it('returns due known blocks, weakest first', () => {
    const state = baseState({
      known: ['a', 'b', 'c'],
      mastery: {
        a: { componentId: 'a', strength: 0.6, lastSeen: 0, dueAt: NOW - 1000 },
        b: { componentId: 'b', strength: 0.2, lastSeen: 0, dueAt: NOW - 1000 },
        c: { componentId: 'c', strength: 0.3, lastSeen: 0, dueAt: NOW + 1_000_000 },
      },
    });
    const due = selectDueTargets(state, NOW);
    expect(due.map((d) => d.componentId)).toEqual(['b', 'a']); // c not due; weakest first
  });

  it('returns nothing when no known block is due', () => {
    const state = baseState({
      known: ['a'],
      mastery: { a: { componentId: 'a', strength: 0.9, lastSeen: 0, dueAt: NOW + 999_999 } },
    });
    expect(selectDueTargets(state, NOW)).toHaveLength(0);
  });
});
