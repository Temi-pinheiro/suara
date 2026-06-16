/**
 * HttpSessionApi — talks to the serverless turn endpoints (createHttpHandler).
 * Swaps in for MockSessionApi when EXPO_PUBLIC_SUARA_API is configured.
 *
 *   nextPrompt()            -> POST {base}/turn/plan
 *   submitAttempt(id, audio)-> POST {base}/turn/{id}/attempt  (recorded audio as body)
 *
 * Auth is a dev x-user-id header for now; production swaps it for a Supabase session
 * token (same header slot on the server's `authenticate` hook).
 */

import type { AudioBlobRef } from '../audio/types';
import type { AttemptResult, PromptPacket, SessionApi } from './types';

export interface HttpSessionApiOptions {
  baseUrl: string;
  userId: string;
}

export class HttpSessionApi implements SessionApi {
  private readonly base: string;
  private readonly userId: string;

  constructor(opts: HttpSessionApiOptions) {
    this.base = opts.baseUrl.replace(/\/$/, '');
    this.userId = opts.userId;
  }

  async nextPrompt(): Promise<PromptPacket> {
    const res = await fetch(`${this.base}/turn/plan`, {
      method: 'POST',
      headers: { 'x-user-id': this.userId },
    });
    if (!res.ok) throw new Error(`plan failed: ${res.status}`);
    return (await res.json()) as PromptPacket;
  }

  async submitAttempt(turnId: string, audio: AudioBlobRef): Promise<AttemptResult> {
    // Read the recorded file (a local file:// uri on device) into a blob to upload.
    const blob = await (await fetch(audio.uri)).blob();
    const res = await fetch(`${this.base}/turn/${encodeURIComponent(turnId)}/attempt`, {
      method: 'POST',
      headers: { 'x-user-id': this.userId, 'content-type': audio.mimeType },
      body: blob,
    });
    if (!res.ok) throw new Error(`attempt failed: ${res.status}`);
    return (await res.json()) as AttemptResult;
  }
}
