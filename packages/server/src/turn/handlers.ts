/**
 * Thin, framework-agnostic turn handlers (request -> response). Mount these in any
 * serverless shell (Supabase Edge Functions by default; Vercel/etc.). The latency-
 * relaxed, two-call shape mirrors the self-paced lesson:
 *   1. planTurnHandler  -> PromptPacketDto   (PLAN + PROMPT; learner then records)
 *   2. attemptHandler   -> AttemptResultDto  (SCORE -> PERSIST on the recording)
 *
 * Construct-first: the prompt deliberately does NOT include the target answer —
 * the learner builds it; the model is revealed only in the attempt response.
 */

import { randomUUID } from 'node:crypto';
import { completeTurn, planTurn, splitSurface, type TurnDeps } from '@suara/core';
import type { AudioBlob } from '@suara/core';
import { loadComponents, loadModules } from '@suara/curriculum';
import type { PendingTurnStore } from './pending';

export interface PlanRequest {
  userId: string;
}

/** The new block taught on an `introduce` turn (hear + see it before producing). */
export interface TeachBlockDto {
  surface: string;
  pinyin?: string;
  modelAudioUrl: string;
}

/** A block the learner already owns and is weaving in this turn (recombine shelf). */
export interface PieceDto {
  surface: string;
  roman?: string;
  /** the block being actively built this turn — highlighted */
  fresh?: boolean;
}

export interface PromptPacketDto {
  turnId: string;
  action: 'introduce' | 'recombine';
  /** L1 setup — spoken + shown. On recombine it must NOT reveal the target answer. */
  englishSetup: string;
  setupAudioUrl: string;
  /** present only on `introduce` turns — the new block to hear/see first */
  teach?: TeachBlockDto;
  /** on `recombine` turns — the owned pieces being combined (NOT the answer) */
  pieces?: PieceDto[];
  classmateAudioUrl?: string;
  /**
   * Suggested hands-free listening window (ms): how long the all-voice client records
   * before auto-submitting. Sized from the target's length so a longer sentence gets
   * more time — WITHOUT revealing the answer (only its rough length leaks).
   */
  recordMs: number;
  /** approx USD cost of producing this call (the spend indicator); set by the http layer */
  costUsd?: number;
}

/**
 * Fixed listening window sized to the target. ~0.9s per syllable/word + a 2.5s think
 * buffer, clamped to a sane 4–12s. The learner never sees the answer; only its length
 * shapes how long the mic stays open.
 */
function recordWindowMs(target: { surface: string; pinyin?: string }): number {
  const roman = target.pinyin ?? target.surface;
  const units = roman.trim().split(/[\s-]+/).filter(Boolean).length || 1;
  return Math.min(12_000, Math.max(4_000, 2_500 + units * 900));
}

export interface AttemptRequest {
  turnId: string;
  /** the learner's recording, decoded by the serverless shell from the upload */
  audio: AudioBlob;
}

export interface AttemptResultDto {
  verdict: 'correct' | 'close' | 'off';
  correction: string;
  /** the warm cue spoken (l1 voice) — played in the all-voice flow before the model */
  correctionAudioUrl: string;
  modelAudioUrl: string;
  /** what the learner actually said (ASR) — shown back as the echo, never a grade */
  transcript: string;
  /** the learner's attempt in romanization (brain-written), so a beginner can read it */
  transcriptRoman?: string;
  /** the revealed model, in the target script (+ romanization) — shown after the attempt */
  modelSurface: string;
  modelPinyin?: string;
  decision: 'advance' | 'rebuild' | 'ease';
  /** tone to coach (drives the client's tone scaffold), if the brain logged one */
  toneFocus?: string;
  /** approx USD cost of producing this call (the spend indicator); set by the http layer */
  costUsd?: number;
}

export interface TurnHandlerDeps {
  deps: TurnDeps;
  pending: PendingTurnStore;
  now?: () => number;
  idgen?: () => string;
}

/**
 * ASR (Scribe) tags non-speech sounds in brackets, e.g. "我也要吃啊。(吃东西的声音)".
 * Strip those so the echo shows only what the learner actually said.
 */
function stripAudioAnnotations(text: string): string {
  return text
    .replace(/[（(【[][^）)】\]]*[）)】\]]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function planTurnHandler(h: TurnHandlerDeps, req: PlanRequest): Promise<PromptPacketDto> {
  const plan = await planTurn(h.deps, req.userId);
  const turnId = (h.idgen ?? randomUUID)();

  await h.pending.put({
    turnId,
    userId: req.userId,
    lang: h.deps.config.code,
    decision: plan.decision,
    ctx: plan.ctx,
    createdAt: (h.now ?? Date.now)(),
  });

  const packet: PromptPacketDto = {
    turnId,
    action: plan.decision.action,
    englishSetup: plan.decision.englishSetup,
    setupAudioUrl: plan.promptAudio.setup.url ?? '',
    recordMs: recordWindowMs(plan.decision.targetUtterance),
  };
  if (plan.teach) {
    packet.teach = plan.teach.pinyin
      ? { surface: plan.teach.surface, pinyin: plan.teach.pinyin, modelAudioUrl: plan.teach.model.url ?? '' }
      : { surface: plan.teach.surface, modelAudioUrl: plan.teach.model.url ?? '' };
  }
  // Recombine shelf: the owned pieces the SRS is weaving in this turn (the honest
  // progress signal). NOT the answer — just the blocks, with the focus highlighted.
  if (plan.decision.action === 'recombine' && plan.ctx.recombinationTargets.length > 0) {
    packet.pieces = plan.ctx.recombinationTargets.map((t) => {
      const { surface, pinyin } = splitSurface(t.surface);
      const piece: PieceDto = { surface };
      if (pinyin) piece.roman = pinyin;
      if (t.id === plan.decision.focusComponentId) piece.fresh = true;
      return piece;
    });
  }
  if (plan.promptAudio.classmate?.url) {
    packet.classmateAudioUrl = plan.promptAudio.classmate.url;
  }
  return packet;
}

export async function attemptHandler(h: TurnHandlerDeps, req: AttemptRequest): Promise<AttemptResultDto> {
  const pending = await h.pending.take(req.turnId);
  if (!pending) {
    throw new Error(`unknown or already-used turn: ${req.turnId}`);
  }

  const result = await completeTurn(h.deps, {
    userId: pending.userId,
    decision: pending.decision,
    ctx: pending.ctx,
    audio: req.audio,
    now: h.now,
  });

  // The first logged error names the tone to coach (cmn: expected tone number).
  const toneFocus = result.record.errorDetail[0]?.expected;
  // The revealed model is the turn's target (clean target script + romanization).
  const target = pending.decision.targetUtterance;

  const dto: AttemptResultDto = {
    verdict: result.feedback.verdict,
    correction: result.feedback.correction,
    correctionAudioUrl: result.correctionAudio.url ?? '',
    modelAudioUrl: result.modelAudio.url ?? '',
    transcript: stripAudioAnnotations(result.transcript),
    modelSurface: target.surface,
    decision: result.feedback.decision,
  };
  if (target.pinyin) dto.modelPinyin = target.pinyin;
  if (result.feedback.attemptRoman) dto.transcriptRoman = result.feedback.attemptRoman;
  if (toneFocus) dto.toneFocus = toneFocus;
  return dto;
}

// --- Path overview (module progress) ---------------------------------------

export interface PiecePathDto {
  surface: string;
  roman?: string;
  /** the learner already has this block */
  owned: boolean;
  /** the block the next lesson will work on */
  current: boolean;
}

export interface ModulePathDto {
  id: string;
  title: string;
  /** done = all owned · here = in progress / holds the current block · ahead = none yet */
  state: 'done' | 'here' | 'ahead';
  pieces: PiecePathDto[];
}

export interface PathDto {
  modules: ModulePathDto[];
}

/**
 * The learner's path: curriculum modules with per-block ownership, derived from the
 * invisible SRS state (never a score). Languages without authored modules return an
 * empty list (the client then goes straight to the lesson).
 */
export async function pathHandler(h: TurnHandlerDeps, req: PlanRequest): Promise<PathDto> {
  const lang = h.deps.config.code;
  const state = await h.deps.store.getState(req.userId, lang);
  const known = new Set(state.known);
  const current = h.deps.graph.nextUnlocked(state)[0]?.id;
  const byId = new Map(loadComponents(lang).map((comp) => [comp.id, comp]));

  const modules: ModulePathDto[] = loadModules(lang).map((m) => {
    const pieces: PiecePathDto[] = m.componentIds.flatMap((id) => {
      const comp = byId.get(id);
      if (!comp) return [];
      const { surface, pinyin } = splitSurface(comp.surface);
      const piece: PiecePathDto = { surface, owned: known.has(id), current: id === current };
      if (pinyin) piece.roman = pinyin;
      return [piece];
    });
    const ownedCount = pieces.filter((p) => p.owned).length;
    const mstate: ModulePathDto['state'] =
      pieces.length > 0 && ownedCount === pieces.length
        ? 'done'
        : ownedCount > 0 || pieces.some((p) => p.current)
          ? 'here'
          : 'ahead';
    return { id: m.id, title: m.title, state: mstate, pieces };
  });

  return { modules };
}
