/**
 * Turn lifecycle orchestration (PLAN.md §3).
 *
 *   PLAN -> PROMPT -> PAUSE -> CAPTURE -> SCORE(ASR ∥ Pron) -> REACT -> SPEAK -> PERSIST
 *
 * Provider-agnostic: everything arrives via the interfaces in ../types and is
 * routed by LanguageConfig, never by `if (lang === ...)`. Imports NO provider SDKs.
 * In `coached` mode the scorer is skipped entirely (CLAUDE.md §6); the brain coaches
 * from the model audio. That path runs identically otherwise.
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

export interface TurnInput {
  userId: string;
  /**
   * Self-paced PAUSE + CAPTURE: the learner builds, then speaks when ready.
   * The host (client/test) supplies the recorded audio for this decision.
   */
  capture: (decision: TurnDecision) => Promise<AudioBlob>;
  /** injectable clock for deterministic tests */
  now?: () => number;
}

export interface PromptAudio {
  setup: AudioRef;
  classmate?: AudioRef;
}

export interface TurnResult {
  decision: TurnDecision;
  promptAudio: PromptAudio;
  transcript: string;
  /** null in coached mode */
  pronScore: PronScore | null;
  feedback: Feedback;
  modelAudio: AudioRef;
  record: TurnRecord;
  /** learner state after persistence (read back from the store) */
  state: LearnerState;
}

function collectErrors(feedback: Feedback): ErrorDetail[] {
  return feedback.masteryDelta.filter(isMasteryError).map((d) => d.logError);
}

export async function runTurn(deps: TurnDeps, input: TurnInput): Promise<TurnResult> {
  const now = input.now ?? Date.now;
  const { config } = deps;
  const lang = config.code;

  // 1. PLAN — brain reads state + graph, picks the next block or recombination.
  const state = await deps.store.getState(input.userId, lang);
  const ctx = buildTurnContext(state, deps.graph, config);
  const decision = await deps.llm.decideTurn(ctx);

  // 2. PROMPT — speak the L1 setup; optionally a classmate attempt (off by default).
  const setup = await deps.tts.synth(decision.englishSetup, config.tts.l1VoiceId, lang);
  const promptAudio: PromptAudio = { setup };
  if (decision.classmateAttempt) {
    const classmateVoice = config.tts.classmateVoiceIds?.[0] ?? config.tts.targetVoiceId;
    promptAudio.classmate = await deps.tts.synth(
      decision.classmateAttempt.utterance,
      classmateVoice,
      lang,
    );
  }

  // 3 + 4. PAUSE + CAPTURE — no timer; the learner speaks first.
  const audio = await input.capture(decision);

  // 5. SCORE — ASR ∥ Pronunciation, in parallel. coached mode skips the scorer.
  const coached = config.pronunciation.mode === 'coached';
  const [asrResult, pronScore] = await Promise.all([
    deps.asr.transcribe(audio, lang),
    coached
      ? Promise.resolve<PronScore | null>(null)
      : deps.pronunciation.score(audio, decision.referenceText, lang),
  ]);
  const transcript = asrResult.text;

  // 6. REACT — brain interprets into the warm model + one correction + next move.
  const scored: ScoredResponse = { decision, transcript, pronScore };
  const feedback = await deps.llm.interpretResponse(scored, ctx);

  // 7. SPEAK — reveal the native model in the target voice.
  const modelAudio = await deps.tts.synth(feedback.spokenModel, config.tts.targetVoiceId, lang);

  // 8. PERSIST — record the turn; the store applies mastery + invisible SRS.
  const record: TurnRecord = {
    componentId: decision.focusComponentId,
    promptText: decision.englishSetup,
    referenceText: decision.referenceText,
    transcript,
    overallScore: pronScore?.overall ?? null,
    errorDetail: collectErrors(feedback),
    masteryDelta: feedback.masteryDelta,
    decision: feedback.decision,
    ts: now(),
  };
  await deps.store.recordTurn(input.userId, lang, record);

  // 9. LOOP — return the post-turn state so the next turn recombines the weak block.
  const nextState = await deps.store.getState(input.userId, lang);

  return {
    decision,
    promptAudio,
    transcript,
    pronScore,
    feedback,
    modelAudio,
    record,
    state: nextState,
  };
}
