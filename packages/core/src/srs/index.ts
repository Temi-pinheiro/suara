/**
 * Invisible spaced-repetition scheduler.
 *
 * MT invariant (CLAUDE.md §2): the learner NEVER experiences a "review". The only
 * surface expression of this scheduler is *which prior blocks get folded into the
 * next sentence the learner constructs* — i.e. it feeds `recombinationTargets`.
 *
 * The orchestrator (not the brain) owns scheduling. Pure functions, no I/O.
 */

import type {
  LearnerState,
  MasteryChange,
  MasteryDelta,
  MasteryRecord,
  TurnOutcome,
} from '../types';
import { isMasteryError } from '../types';

const MINUTE_MS = 60_000;

/** Strength steps per outcome. Strengthen on success, nudge on partial, decay on miss. */
const STRENGTH_STEP: Record<MasteryChange, number> = {
  strengthen: 0.34,
  partial: 0.15,
  weaken: -0.2,
};

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/**
 * Expanding interval: stronger blocks come due later. Ranges ~5min (cold) to ~18h
 * (strong). Deliberately simple for Phase 0; the curve is tunable later.
 */
export function dueIntervalMs(strength: number): number {
  const minutes = Math.round(5 * Math.pow(6, clamp01(strength) * 3));
  return minutes * MINUTE_MS;
}

export function isDue(rec: MasteryRecord, now: number): boolean {
  return rec.dueAt <= now;
}

/** Apply a single strength change to a mastery record (creating it if absent). */
export function applyChange(
  rec: MasteryRecord | undefined,
  componentId: string,
  change: MasteryChange,
  now: number,
): MasteryRecord {
  const prev = rec?.strength;
  const prevStrength = typeof prev === 'number' && Number.isFinite(prev) ? prev : 0;
  const step = STRENGTH_STEP[change] ?? 0; // unknown change from the brain -> no-op
  const strength = clamp01(prevStrength + step);
  return { componentId, strength, lastSeen: now, dueAt: now + dueIntervalMs(strength) };
}

export interface TurnOutcomeInput {
  focusComponentId: string;
  masteryDelta: MasteryDelta[];
  outcome: TurnOutcome;
}

/**
 * Fold a completed turn into learner state: update mastery from the turn's deltas,
 * mark the focus component known once it crosses the threshold, and bump the turn
 * counter. Returns a NEW state (no mutation). Takes the minimal shape so a
 * LearnerStore can apply it straight from a persisted TurnRecord.
 */
export function applyTurnOutcome(
  state: LearnerState,
  p: TurnOutcomeInput,
  now: number,
): LearnerState {
  const mastery: Record<string, MasteryRecord> = { ...state.mastery };

  let focusTouched = false;
  for (const delta of p.masteryDelta) {
    if (isMasteryError(delta)) continue; // error grain is persisted as TurnRecord detail
    mastery[delta.componentId] = applyChange(
      mastery[delta.componentId],
      delta.componentId,
      delta.change,
      now,
    );
    if (delta.componentId === p.focusComponentId) focusTouched = true;
  }

  // The focus block was just practiced — always refresh its schedule (lastSeen/dueAt),
  // even if it already had a record and the brain omitted a delta for it.
  if (!focusTouched) {
    mastery[p.focusComponentId] = applyChange(
      mastery[p.focusComponentId],
      p.focusComponentId,
      p.outcome === 'advance' ? 'strengthen' : 'partial',
      now,
    );
  }

  // "known" = introduced & available for recombination (NOT deep mastery — that is
  // the `strength` dimension, which drives only the invisible SRS schedule). A block
  // joins the known set once the learner advances past it, or when we ease off and
  // quietly requeue it. On `rebuild` it stays out, so the next turn retries it.
  const known = new Set(state.known);
  if (p.outcome === 'advance' || p.outcome === 'ease') {
    known.add(p.focusComponentId);
  }

  return {
    ...state,
    mastery,
    known: [...known],
    turnIndex: state.turnIndex + 1,
  };
}

/**
 * Pick the recombination targets: known components that are due, weakest-first.
 * This is the ONLY place SRS surfaces — as blocks to weave into the next build.
 */
export function selectDueTargets(
  state: LearnerState,
  now: number,
  limit = 3,
): MasteryRecord[] {
  return state.known
    .map((id) => state.mastery[id])
    .filter((rec): rec is MasteryRecord => rec !== undefined && isDue(rec, now))
    .sort((a, b) => a.strength - b.strength)
    .slice(0, limit);
}
