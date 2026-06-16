/**
 * Structured-output contract for the brain. Real LLMProviders enforce these via
 * tool use / response schema so the brain can only emit valid JSON (brain-spec §5).
 * The runtime asserts here are the "validate before use" guard.
 */

import type {
  DecisionAction,
  Feedback,
  MasteryChange,
  MasteryDelta,
  TurnDecision,
  TurnOutcome,
  Verdict,
} from '../types';
import { FORBIDDEN_PERSONA_PHRASES } from './persona';

// JSON Schema objects (passed to provider tool definitions). Kept deliberately
// permissive on nested optionals; the runtime asserts below do the hard checks.
export const TURN_DECISION_SCHEMA = {
  type: 'object',
  required: [
    'action',
    'focusComponentId',
    'recombinedComponentIds',
    'englishSetup',
    'targetUtterance',
    'referenceText',
    'teachingNote',
  ],
  properties: {
    action: { type: 'string', enum: ['introduce', 'recombine'] },
    focusComponentId: { type: 'string' },
    recombinedComponentIds: { type: 'array', items: { type: 'string' } },
    englishSetup: { type: 'string' },
    targetUtterance: {
      type: 'object',
      required: ['surface'],
      properties: {
        surface: { type: 'string' },
        pinyin: { type: 'string' },
        expectedTones: { type: 'string' },
      },
    },
    referenceText: { type: 'string' },
    teachingNote: { type: 'string' },
    classmateAttempt: { type: ['object', 'null'] },
    reassurance: { type: ['string', 'null'] },
  },
} as const;

export const FEEDBACK_SCHEMA = {
  type: 'object',
  required: ['verdict', 'spokenModel', 'correction', 'decision', 'masteryDelta'],
  properties: {
    verdict: { type: 'string', enum: ['correct', 'close', 'off'] },
    spokenModel: { type: 'string' },
    correction: { type: 'string' },
    decision: { type: 'string', enum: ['advance', 'rebuild', 'ease'] },
    masteryDelta: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            required: ['componentId', 'change'],
            properties: {
              componentId: { type: 'string' },
              change: { type: 'string', enum: ['strengthen', 'partial', 'weaken'] },
            },
          },
          {
            type: 'object',
            required: ['logError'],
            properties: {
              logError: {
                type: 'object',
                required: ['unit', 'expected', 'produced'],
                properties: {
                  unit: { type: 'string' },
                  expected: { type: 'string' },
                  produced: { type: 'string' },
                  score: { type: 'number' },
                },
              },
            },
          },
        ],
      },
    },
    nextPrompt: { type: ['string', 'null'] },
    revealNote: { type: ['string', 'null'] },
  },
} as const;

const DECISION_ACTIONS: readonly DecisionAction[] = ['introduce', 'recombine'];
const VERDICTS: readonly Verdict[] = ['correct', 'close', 'off'];
const OUTCOMES: readonly TurnOutcome[] = ['advance', 'rebuild', 'ease'];
const MASTERY_CHANGES: readonly MasteryChange[] = ['strengthen', 'partial', 'weaken'];

/** Keep only well-formed deltas; a chatty brain can't smuggle a bad `change` into SRS. */
function coerceMasteryDeltas(arr: unknown[]): MasteryDelta[] {
  const out: MasteryDelta[] = [];
  for (const d of arr) {
    if (!isRecord(d)) continue;
    if (isRecord(d.logError)) {
      const e = d.logError;
      const entry: MasteryDelta = {
        logError: {
          unit: typeof e.unit === 'string' ? e.unit : String(e.unit ?? ''),
          expected: typeof e.expected === 'string' ? e.expected : String(e.expected ?? ''),
          produced: typeof e.produced === 'string' ? e.produced : String(e.produced ?? ''),
          ...(typeof e.score === 'number' ? { score: e.score } : {}),
        },
      };
      out.push(entry);
    } else if (
      typeof d.componentId === 'string' &&
      MASTERY_CHANGES.includes(d.change as MasteryChange)
    ) {
      out.push({ componentId: d.componentId, change: d.change as MasteryChange });
    }
    // anything else (unknown change, missing fields) is dropped
  }
  return out;
}

class SchemaError extends Error {}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v !== 'string') throw new SchemaError(`expected string at "${k}"`);
  return v;
}

/** Assert the brain never spoke a forbidden MT phrase (persona gate). */
export function assertNoForbiddenPhrases(text: string): void {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PERSONA_PHRASES) {
    if (lower.includes(phrase)) {
      throw new SchemaError(`forbidden persona phrase: "${phrase}"`);
    }
  }
}

export function assertTurnDecision(x: unknown): TurnDecision {
  if (!isRecord(x)) throw new SchemaError('TurnDecision must be an object');
  const action = str(x, 'action') as DecisionAction;
  if (!DECISION_ACTIONS.includes(action)) throw new SchemaError(`bad action: ${action}`);
  if (!Array.isArray(x.recombinedComponentIds)) {
    throw new SchemaError('recombinedComponentIds must be an array');
  }
  if (!isRecord(x.targetUtterance)) throw new SchemaError('targetUtterance must be an object');

  return {
    action,
    focusComponentId: str(x, 'focusComponentId'),
    recombinedComponentIds: x.recombinedComponentIds.map(String),
    englishSetup: str(x, 'englishSetup'),
    targetUtterance: {
      surface: str(x.targetUtterance, 'surface'),
      pinyin:
        typeof x.targetUtterance.pinyin === 'string' ? x.targetUtterance.pinyin : undefined,
      expectedTones:
        typeof x.targetUtterance.expectedTones === 'string'
          ? x.targetUtterance.expectedTones
          : undefined,
    },
    referenceText: str(x, 'referenceText'),
    teachingNote: str(x, 'teachingNote'),
    classmateAttempt: isRecord(x.classmateAttempt)
      ? {
          utterance: str(x.classmateAttempt, 'utterance'),
          isError: Boolean(x.classmateAttempt.isError),
          note: str(x.classmateAttempt, 'note'),
        }
      : null,
    reassurance: typeof x.reassurance === 'string' ? x.reassurance : null,
  };
}

export function assertFeedback(x: unknown): Feedback {
  if (!isRecord(x)) throw new SchemaError('Feedback must be an object');
  const verdict = str(x, 'verdict') as Verdict;
  if (!VERDICTS.includes(verdict)) throw new SchemaError(`bad verdict: ${verdict}`);
  const decision = str(x, 'decision') as TurnOutcome;
  if (!OUTCOMES.includes(decision)) throw new SchemaError(`bad decision: ${decision}`);
  if (!Array.isArray(x.masteryDelta)) throw new SchemaError('masteryDelta must be an array');

  return {
    verdict,
    spokenModel: str(x, 'spokenModel'),
    correction: str(x, 'correction'),
    decision,
    masteryDelta: coerceMasteryDeltas(x.masteryDelta),
    nextPrompt: typeof x.nextPrompt === 'string' ? x.nextPrompt : null,
    revealNote: typeof x.revealNote === 'string' ? x.revealNote : null,
  };
}
