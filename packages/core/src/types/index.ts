/**
 * Shared domain types + provider interfaces for Suara.
 *
 * This file is the authoritative TypeScript expression of `CLAUDE.md §5`.
 * It imports NO provider/infra SDKs — the engine is language- and host-agnostic.
 * If a provider signature changes here, update `CLAUDE.md §5` and `PLAN.md` too.
 */

// ---------------------------------------------------------------------------
// Language identity
// ---------------------------------------------------------------------------

export type LangCode = 'cmn' | 'jpn' | 'kor' | 'ind' | 'hin';

export type L1 = 'eng';

export type Phonology = 'tonal' | 'pitch-accent' | 'non-tonal';

/**
 * Pronunciation feedback ranges over three modes:
 *   'tone'      -> Mandarin only (initial/final/tone scoring)
 *   'segmental' -> Japanese, Korean, Hindi (phoneme/word accuracy)
 *   'coached'   -> Indonesian (no scoring vendor; brain coaches from model audio)
 */
export type PronMode = 'tone' | 'segmental' | 'coached';

export interface LanguageConfig {
  code: LangCode;
  l1: L1;
  phonology: Phonology;
  /** cmn only, e.g. ['1','2','3','4','0'] */
  toneInventory?: string[];
  tts: {
    provider: string;
    targetVoiceId: string;
    l1VoiceId: string;
    classmateVoiceIds?: string[];
  };
  /** provider omitted when mode === 'coached' */
  pronunciation: { mode: PronMode; provider?: string };
  /**
   * Simulated classmates (PLAN.md §2, decision #4) — OFF by default. When true (and
   * classmateVoiceIds are set) the brain may include an instructive classmate attempt
   * the teacher then corrects. Purely additive: the turn loop already handles it.
   */
  classmates?: boolean;
}

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

export type ComponentKind = 'word' | 'connector' | 'pattern' | 'function';

export interface Component {
  id: string;
  lang: LangCode;
  kind: ComponentKind;
  /** target-language form (+ romanization), e.g. "茶 (chá)" */
  surface: string;
  /** English meaning / generative rule */
  glossEn: string;
  /** the one-line generative rule the brain teaches (MT: rule, not definition) */
  rule?: string;
  /** nullable; cmn only, e.g. "3-3-1-2" */
  expectedTones?: string | null;
  prereqIds: string[];
  /** the first sentence(s) this block unlocks using only prior blocks */
  recombHint?: string;
  introAudioRef?: AudioRef;
  modelAudioRefs?: AudioRef[];
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/** Learner-captured audio (mic). */
export interface AudioBlob {
  bytes: Uint8Array;
  mimeType: string;
  durationMs?: number;
}

/** A reference to synthesized/cached audio (lives in the R2 cache). */
export interface AudioRef {
  /** content-hash cache key: hash(text, voiceId) */
  cacheKey: string;
  text: string;
  voiceId: string;
  lang: LangCode;
  /** resolved object URL (R2/CDN); may be absent until uploaded */
  url?: string;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Learner state + persistence
// ---------------------------------------------------------------------------

export interface MasteryRecord {
  componentId: string;
  /** 0..1 */
  strength: number;
  /** epoch ms */
  lastSeen: number;
  /** epoch ms; drives the invisible SRS */
  dueAt: number;
}

export interface LearnerState {
  userId: string;
  lang: LangCode;
  /** component ids the learner has been introduced to / can be recombined */
  known: string[];
  mastery: Record<string, MasteryRecord>;
  turnIndex: number;
  /** brief summaries of recent turns, for brain context */
  lastTurns: string[];
}

export interface ErrorDetail {
  /** syllable / phoneme grain */
  unit: string;
  expected: string;
  produced: string;
  score?: number;
}

export interface TurnRecord {
  componentId: string;
  promptText: string;
  referenceText: string;
  transcript: string;
  overallScore: number | null;
  errorDetail: ErrorDetail[];
  /** how the turn moved mastery — the store persists turns + mastery from this */
  masteryDelta: MasteryDelta[];
  decision: TurnOutcome;
  /** epoch ms */
  ts: number;
}

// ---------------------------------------------------------------------------
// Brain I/O — the structured turn contract (see brain-spec.md)
// ---------------------------------------------------------------------------

export interface AvailableBlock {
  id: string;
  surface: string;
  glossEn: string;
  rule?: string;
  expectedTones?: string | null;
}

export interface RecombinationTargetRef {
  id: string;
  surface: string;
  reason: string;
}

export interface TurnContext {
  language: {
    code: LangCode;
    l1: L1;
    phonology: Phonology;
    pronunciationMode: PronMode;
    toneInventory?: string[];
  };
  session: { turnIndex: number; lastTurns: string[] };
  known: string[];
  availableBlocks: AvailableBlock[];
  recombinationTargets: RecombinationTargetRef[];
  /** when true the brain may emit a classmateAttempt this turn (off by default) */
  classmatesEnabled?: boolean;
}

export type DecisionAction = 'introduce' | 'recombine';

export interface TargetUtterance {
  surface: string;
  pinyin?: string;
  expectedTones?: string;
}

export interface ClassmateAttempt {
  utterance: string;
  isError: boolean;
  note: string;
}

export interface TurnDecision {
  action: DecisionAction;
  focusComponentId: string;
  recombinedComponentIds: string[];
  /** L1 setup prompt — the learner builds, then speaks first */
  englishSetup: string;
  targetUtterance: TargetUtterance;
  /** passed to the pronunciation scorer */
  referenceText: string;
  teachingNote: string;
  /** off by default in Phase 1 (decision #4) */
  classmateAttempt: ClassmateAttempt | null;
  reassurance: string | null;
}

export interface PerUnitScore {
  unit: string;
  score: number;
  expectedTone?: string;
  producedTone?: string;
}

/** Reference-based pronunciation score. CoachedProvider returns null fields. */
export interface PronScore {
  overall: number | null;
  perSyllable: PerUnitScore[];
  tone?: PerUnitScore[] | null;
}

export interface ScoredResponse {
  decision: TurnDecision;
  transcript: string;
  /** null when pronunciationMode === 'coached' */
  pronScore: PronScore | null;
}

export type Verdict = 'correct' | 'close' | 'off';
export type TurnOutcome = 'advance' | 'rebuild' | 'ease';
export type MasteryChange = 'strengthen' | 'partial' | 'weaken';

export interface MasteryDeltaStrength {
  componentId: string;
  change: MasteryChange;
}
export interface MasteryDeltaError {
  logError: ErrorDetail;
}
export type MasteryDelta = MasteryDeltaStrength | MasteryDeltaError;

export function isMasteryError(d: MasteryDelta): d is MasteryDeltaError {
  return 'logError' in d;
}

export interface Feedback {
  verdict: Verdict;
  /** always reveal the correct form */
  spokenModel: string;
  correction: string;
  decision: TurnOutcome;
  masteryDelta: MasteryDelta[];
  nextPrompt: string | null;
  /** first-time sandhi/structure note, else null */
  revealNote: string | null;
}

// ---------------------------------------------------------------------------
// Provider interfaces (CLAUDE.md §5) — implemented in packages/providers.
// core depends on these; never on a concrete provider.
// ---------------------------------------------------------------------------

/** The "teacher brain". */
export interface LLMProvider {
  decideTurn(ctx: TurnContext): Promise<TurnDecision>;
  interpretResponse(r: ScoredResponse, ctx: TurnContext): Promise<Feedback>;
}

export interface TTSProvider {
  /** implementations must cache by (text, voiceId) hash — see cost rules */
  synth(text: string, voiceId: string, lang: LangCode): Promise<AudioRef>;
}

export interface ASRProvider {
  transcribe(audio: AudioBlob, lang: LangCode): Promise<{ text: string }>;
}

/** Reference-based; we always know the target. */
export interface PronunciationProvider {
  score(audio: AudioBlob, referenceText: string, lang: LangCode): Promise<PronScore>;
}

export interface LearnerStore {
  getState(userId: string, lang: LangCode): Promise<LearnerState>;
  recordTurn(userId: string, lang: LangCode, t: TurnRecord): Promise<void>;
}

export interface CurriculumGraph {
  /** respects prereqs */
  nextUnlocked(state: LearnerState): Component[];
  /** SRS-driven, invisible */
  recombinationTargets(state: LearnerState): Component[];
}
