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
import { completeTurn, planTurn, type TurnDeps } from '@suara/core';
import type { AudioBlob } from '@suara/core';
import type { PendingTurnStore } from './pending';

export interface PlanRequest {
  userId: string;
}

export interface PromptPacketDto {
  turnId: string;
  /** L1 setup — spoken + shown as an optional aid. No target answer here. */
  englishSetup: string;
  setupAudioUrl: string;
  classmateAudioUrl?: string;
}

export interface AttemptRequest {
  turnId: string;
  /** the learner's recording, decoded by the serverless shell from the upload */
  audio: AudioBlob;
}

export interface AttemptResultDto {
  verdict: 'correct' | 'close' | 'off';
  correction: string;
  modelAudioUrl: string;
  decision: 'advance' | 'rebuild' | 'ease';
  /** tone to coach (drives the client's tone scaffold), if the brain logged one */
  toneFocus?: string;
}

export interface TurnHandlerDeps {
  deps: TurnDeps;
  pending: PendingTurnStore;
  now?: () => number;
  idgen?: () => string;
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
    englishSetup: plan.decision.englishSetup,
    setupAudioUrl: plan.promptAudio.setup.url ?? '',
  };
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

  const dto: AttemptResultDto = {
    verdict: result.feedback.verdict,
    correction: result.feedback.correction,
    modelAudioUrl: result.modelAudio.url ?? '',
    decision: result.feedback.decision,
  };
  if (toneFocus) dto.toneFocus = toneFocus;
  return dto;
}
