/**
 * HttpSessionApi — talks to the serverless turn endpoints (createHttpHandler).
 * The client's only SessionApi: every turn round-trips to the real backend.
 *
 *   nextPrompt()            -> POST {base}/turn/plan
 *   submitAttempt(id, audio)-> POST {base}/turn/{id}/attempt  (recorded audio as body)
 *
 * Auth is a dev x-user-id header for now; production swaps it for a Supabase session
 * token (same header slot on the server's `authenticate` hook).
 */

import type { AudioBlobRef } from '../audio/types';
import type { AttemptResult, PathView, PromptPacket, SessionApi } from './types';

export interface HttpSessionApiOptions {
  baseUrl: string;
  userId: string;
  /** target language (x-suara-lang) — the server routes the turn to it */
  lang?: string;
}

export class HttpSessionApi implements SessionApi {
  private readonly base: string;
  private readonly userId: string;
  private readonly lang: string | undefined;

  constructor(opts: HttpSessionApiOptions) {
    this.base = opts.baseUrl.replace(/\/$/, '');
    this.userId = opts.userId;
    this.lang = opts.lang;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'x-user-id': this.userId, ...(this.lang ? { 'x-suara-lang': this.lang } : {}), ...extra };
  }

  async getPath(): Promise<PathView> {
    const res = await fetch(`${this.base}/path`, { method: 'GET', headers: this.headers() });
    if (!res.ok) throw new Error(`path failed: ${res.status}`);
    return (await res.json()) as PathView;
  }

  async nextPrompt(): Promise<PromptPacket> {
    const res = await fetch(`${this.base}/turn/plan`, { method: 'POST', headers: this.headers() });
    if (!res.ok) throw new Error(`plan failed: ${res.status}`);
    return (await res.json()) as PromptPacket;
  }

  async submitAttempt(turnId: string, audio: AudioBlobRef): Promise<AttemptResult> {
    // Read the recorded file (a local file:// uri on device) into a blob to upload.
    const blob = await (await fetch(audio.uri)).blob();
    const res = await fetch(`${this.base}/turn/${encodeURIComponent(turnId)}/attempt`, {
      method: 'POST',
      headers: this.headers({ 'content-type': audio.mimeType }),
      body: blob,
    });
    if (!res.ok) throw new Error(`attempt failed: ${res.status}`);
    return (await res.json()) as AttemptResult;
  }
}
