/**
 * Pure lesson state machine for one self-paced turn.
 *
 * Encodes the MT invariants structurally:
 *  - construct-first: after hearing the L1 setup the learner BUILDS and speaks;
 *    the model is revealed only in `feedback`, after the attempt.
 *  - self-paced: `awaiting` has no timer; it advances only on START_RECORDING.
 *  - rebuild once: a `rebuild` decision returns to `awaiting` (retry the same
 *    prompt); advance/ease move on to the next turn.
 *
 * Pure (no React, no platform) so the whole turn flow is unit-testable.
 */

import type { AttemptResult, PromptPacket } from '../api/types';
import type { AudioBlobRef } from '../audio/types';

export type LessonPhase =
  | 'idle'
  | 'loading'
  | 'prompting'
  | 'awaiting'
  | 'recording'
  | 'scoring'
  | 'feedback'
  | 'error';

export interface LessonState {
  phase: LessonPhase;
  prompt: PromptPacket | null;
  attempt: AttemptResult | null;
  error: string | null;
}

export type LessonEvent =
  | { type: 'LOAD' }
  | { type: 'PROMPT_READY'; prompt: PromptPacket }
  | { type: 'PROMPT_PLAYED' }
  | { type: 'START_RECORDING' }
  | { type: 'SUBMIT'; audio: AudioBlobRef }
  | { type: 'SCORED'; result: AttemptResult }
  | { type: 'FEEDBACK_PLAYED' }
  | { type: 'FAIL'; error: string };

export const initialLessonState: LessonState = {
  phase: 'idle',
  prompt: null,
  attempt: null,
  error: null,
};

export function lessonReducer(state: LessonState, event: LessonEvent): LessonState {
  switch (event.type) {
    case 'LOAD':
      return { ...state, phase: 'loading', attempt: null, error: null };

    case 'PROMPT_READY':
      return { ...state, phase: 'prompting', prompt: event.prompt };

    case 'PROMPT_PLAYED':
      // setup heard -> learner builds & speaks first (self-paced from here)
      return state.phase === 'prompting' ? { ...state, phase: 'awaiting' } : state;

    case 'START_RECORDING':
      return state.phase === 'awaiting' ? { ...state, phase: 'recording' } : state;

    case 'SUBMIT':
      return state.phase === 'recording' ? { ...state, phase: 'scoring' } : state;

    case 'SCORED':
      return { ...state, phase: 'feedback', attempt: event.result };

    case 'FEEDBACK_PLAYED': {
      if (state.phase !== 'feedback') return state;
      // rebuild -> retry the same prompt; advance/ease -> next turn
      if (state.attempt?.decision === 'rebuild') {
        return { ...state, phase: 'awaiting', attempt: null };
      }
      return { ...state, phase: 'loading', attempt: null };
    }

    case 'FAIL':
      return { ...state, phase: 'error', error: event.error };

    default:
      return state;
  }
}

/** True while the learner is free to start speaking (drives the speak button). */
export function canSpeak(state: LessonState): boolean {
  return state.phase === 'awaiting';
}
