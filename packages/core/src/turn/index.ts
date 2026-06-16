/**
 * Turn lifecycle orchestration (PLAN.md §3).
 *
 *   PLAN -> PROMPT -> PAUSE -> CAPTURE -> SCORE(ASR ∥ Pron) -> REACT -> SPEAK -> PERSIST
 *
 * Split into two halves so a real (stateless, serverless) turn can span two HTTP
 * requests with the learner recording in between:
 *   - planTurn:     PLAN + PROMPT  (returns the decision + prompt audio)
 *   - completeTurn: SCORE..PERSIST (takes the captured audio, returns feedback)
 * runTurn composes them with a capture callback for in-process use + tests.
 *
 * Provider-agnostic: everything arrives via the interfaces in ../types and is
 * routed by LanguageConfig, never by `if (lang === ...)`. Imports NO provider SDKs.
 * In `coached` mode the scorer is skipped entirely (CLAUDE.md §6).
 */

import { buildTurnContext } from '../brain';
import type {
  ASRProvider,
  AudioBlob,
  AudioRef,
  CurriculumGraph,
  ErrorDetail,
  Feedback,
  LLMProvider,
  LanguageConfig,
  LearnerState,
  LearnerStore,
  PronScore,
  PronunciationProvider,
  ScoredResponse,
  TTSProvider,
  TurnContext,
  TurnDecision,
  TurnRecord,
} from '../types';
import { isMasteryError } from '../types';

export interface TurnDeps {
  config: LanguageConfig;
  llm: LLMProvider;
  tts: TTSProvider;
  asr: ASRProvider;
  pronunciation: PronunciationProvider;
  store: LearnerStore;
  graph: CurriculumGraph;
}

export interface PromptAudio {
  setup: AudioRef;
  /** on `introduce` turns: the new block modeled in the target voice (hear it first) */
  model?: AudioRef;
  classmate?: AudioRef;
}

/** The new block taught on an `introduce` turn — you can't produce an unheard word. */
export interface TeachBlock {
  surface: string;
  pinyin?: string;
  model: AudioRef;
}

export interface PlanResult {
  decision: TurnDecision;
  promptAudio: PromptAudio;
  /** carried to completeTurn so interpretResponse sees the same context */
  ctx: TurnContext;
  /** present only on `introduce` turns */
  teach?: TeachBlock;
}

/** Split a curriculum surface like "我 (wǒ)" into { surface: '我', pinyin: 'wǒ' }. */
export function splitSurface(raw: string): { surface: string; pinyin?: string } {
  const m = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) return { surface: m[1]!.trim(), pinyin: m[2]!.trim() };
  return { surface: raw.trim() };
}

export interface CompleteTurnInput {
  userId: string;
  decision: TurnDecision;
  ctx: TurnContext;
  audio: AudioBlob;
  now?: () => number;
}

export interface CompleteTurnResult {
  transcript: string;
  pronScore: PronScore | null;
  feedback: Feedback;
  modelAudio: AudioRef;
  record: TurnRecord;
  /** learner state after persistence (read back from the store) */
  state: LearnerState;
}

export interface TurnInput {
  userId: string;
  /** self-paced PAUSE + CAPTURE: the learner builds, then speaks when ready */
  capture: (decision: TurnDecision) => Promise<AudioBlob>;
  now?: () => number;
}

export interface TurnResult extends CompleteTurnResult {
  decision: TurnDecision;
  promptAudio: PromptAudio;
}

function collectErrors(feedback: Feedback): ErrorDetail[] {
  return feedback.masteryDelta.filter(isMasteryError).map((d) => d.logError);
}

/** PLAN + PROMPT: brain picks the next block; TTS speaks the L1 setup. */
export async function planTurn(deps: TurnDeps, userId: string): Promise<PlanResult> {
  const lang = deps.config.code;
  const state = await deps.store.getState(userId, lang);
  const ctx = buildTurnContext(state, deps.graph, deps.config);
  const decision = await deps.llm.decideTurn(ctx);

  const setup = await deps.tts.synth(decision.englishSetup, deps.config.tts.l1VoiceId, lang);
  const promptAudio: PromptAudio = { setup };

  // Introduce = TEACH the new block first: model it in the target voice + surface its
  // pinyin, so the learner hears the word before being asked to produce it. The full
  // target sentence is still constructed (not revealed). Recombine teaches nothing new.
  let teach: TeachBlock | undefined;
  if (decision.action === 'introduce') {
    const block = ctx.availableBlocks.find((b) => b.id === decision.focusComponentId);
    const { surface, pinyin } = splitSurface(block?.surface ?? decision.targetUtterance.surface);
    const model = await deps.tts.synth(surface, deps.config.tts.targetVoiceId, lang);
    promptAudio.model = model;
    teach = pinyin ? { surface, pinyin, model } : { surface, model };
  }

  if (decision.classmateAttempt) {
    const classmateVoice = deps.config.tts.classmateVoiceIds?.[0] ?? deps.config.tts.targetVoiceId;
    promptAudio.classmate = await deps.tts.synth(decision.classmateAttempt.utterance, classmateVoice, lang);
  }

  return teach ? { decision, promptAudio, ctx, teach } : { decision, promptAudio, ctx };
}

/** SCORE (ASR ∥ Pron) -> REACT -> SPEAK -> PERSIST. coached mode skips the scorer. */
export async function completeTurn(
  deps: TurnDeps,
  input: CompleteTurnInput,
): Promise<CompleteTurnResult> {
  const now = input.now ?? Date.now;
  const lang = deps.config.code;
  const coached = deps.config.pronunciation.mode === 'coached';

  const [asrResult, pronScore] = await Promise.all([
    deps.asr.transcribe(input.audio, lang),
    coached
      ? Promise.resolve<PronScore | null>(null)
      : deps.pronunciation.score(input.audio, input.decision.referenceText, lang),
  ]);
  const transcript = asrResult.text;

  const scored: ScoredResponse = { decision: input.decision, transcript, pronScore };
  const feedback = await deps.llm.interpretResponse(scored, input.ctx);

  const modelAudio = await deps.tts.synth(feedback.spokenModel, deps.config.tts.targetVoiceId, lang);

  const record: TurnRecord = {
    componentId: input.decision.focusComponentId,
    promptText: input.decision.englishSetup,
    referenceText: input.decision.referenceText,
    transcript,
    overallScore: pronScore?.overall ?? null,
    errorDetail: collectErrors(feedback),
    masteryDelta: feedback.masteryDelta,
    decision: feedback.decision,
    ts: now(),
  };
  await deps.store.recordTurn(input.userId, lang, record);
  const state = await deps.store.getState(input.userId, lang);

  return { transcript, pronScore, feedback, modelAudio, record, state };
}

/** Full lifecycle in one call (in-process + tests): plan, capture, complete. */
export async function runTurn(deps: TurnDeps, input: TurnInput): Promise<TurnResult> {
  const plan = await planTurn(deps, input.userId);
  const audio = await input.capture(plan.decision);
  const rest = await completeTurn(deps, {
    userId: input.userId,
    decision: plan.decision,
    ctx: plan.ctx,
    audio,
    now: input.now,
  });
  return { decision: plan.decision, promptAudio: plan.promptAudio, ...rest };
}
