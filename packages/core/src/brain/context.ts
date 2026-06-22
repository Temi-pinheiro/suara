/**
 * Turn-context assembly: LearnerState + CurriculumGraph + LanguageConfig -> the
 * TurnContext handed to the brain. This is the per-call "delta" (uncached); the
 * persona + graph are the cached static prefix.
 */

import type {
  AvailableBlock,
  Component,
  CurriculumGraph,
  LanguageConfig,
  LearnerState,
  RecombinationTargetRef,
  TurnContext,
} from '../types';

export function toAvailableBlock(c: Component): AvailableBlock {
  return {
    id: c.id,
    surface: c.surface,
    glossEn: c.glossEn,
    rule: c.rule,
    expectedTones: c.expectedTones ?? null,
  };
}

export function toRecombinationTargetRef(c: Component): RecombinationTargetRef {
  return { id: c.id, surface: c.surface, reason: 'due for reuse' };
}

export function buildTurnContext(
  state: LearnerState,
  graph: CurriculumGraph,
  config: LanguageConfig,
): TurnContext {
  return {
    language: {
      code: config.code,
      l1: config.l1,
      phonology: config.phonology,
      pronunciationMode: config.pronunciation.mode,
      toneInventory: config.toneInventory,
    },
    session: { turnIndex: state.turnIndex, lastTurns: state.lastTurns },
    known: state.known,
    availableBlocks: graph.nextUnlocked(state).map(toAvailableBlock),
    recombinationTargets: graph.recombinationTargets(state).map(toRecombinationTargetRef),
    // Surfaced so the (mock + real) brain knows it may add a classmate this turn.
    // Real brains see this via the JSON-serialized context; off unless config opts in.
    classmatesEnabled: config.classmates === true && (config.tts.classmateVoiceIds?.length ?? 0) > 0,
  };
}
