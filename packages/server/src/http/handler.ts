/**
 * Framework-agnostic HTTP entry (Web Request -> Response) around the two-phase turn
 * handlers. Runs in any shell with the Fetch API: Supabase Edge Functions (Deno),
 * Vercel, or the Node dev server (scripts/serve.mts).
 *
 *   POST /turn/plan            -> PromptPacketDto      (learner id from auth)
 *   POST /turn/{turnId}/attempt-> AttemptResultDto     (raw audio bytes as the body)
 *
 * Auth is injected: dev uses an x-user-id header; production plugs in Supabase JWT
 * verification behind the same `authenticate` hook.
 */

import type { AudioBlob } from '@suara/core';
import { attemptHandler, planTurnHandler, type TurnHandlerDeps } from '../turn/handlers';
import { UsageMeter } from '../cost/meter';
import { estimateCost } from '../cost/pricing';

export class UnauthorizedError extends Error {}

export interface HttpHandlerOptions {
  /** Resolve the learner id from the request (verify a Supabase JWT in prod). */
  authenticate: (req: Request) => Promise<string> | string;
  /** CORS allow-origin; default '*' for dev. */
  corsOrigin?: string;
}

/** Dev auth: trust an `x-user-id` header. Replace with Supabase JWT verification. */
export function devHeaderAuth(req: Request): string {
  const userId = req.headers.get('x-user-id');
  if (!userId) throw new UnauthorizedError('missing x-user-id header');
  return userId;
}

export type HttpHandler = (req: Request) => Promise<Response>;

/**
 * Either a single deps (one language) or a resolver that picks deps by the request's
 * `x-suara-lang` (the picker / runtime language switching). The client sends the same
 * language on plan + attempt, so the pair stays consistent.
 */
export type DepsSource =
  | TurnHandlerDeps
  | ((lang: string | undefined, meter?: UsageMeter) => TurnHandlerDeps);

/** Fold this call's tallied cost into the response (the client accumulates it). */
function withCost<T extends { costUsd?: number }>(dto: T, meter?: UsageMeter): T {
  if (meter) dto.costUsd = Math.round(estimateCost(meter.usage).totalUsd * 1e5) / 1e5;
  return dto;
}

export function createHttpHandler(deps: DepsSource, opts: HttpHandlerOptions): HttpHandler {
  // A resolver lets us meter each request in isolation; a single deps (tests) is unmetered.
  const isResolver = typeof deps === 'function';
  const resolve = isResolver ? deps : () => deps;
  const cors: Record<string, string> = {
    'access-control-allow-origin': opts.corsOrigin ?? '*',
    'access-control-allow-headers': 'authorization, content-type, x-user-id, x-suara-lang',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    try {
      const userId = await opts.authenticate(req);
      const meter = isResolver ? new UsageMeter() : undefined;
      const turnDeps = resolve(req.headers.get('x-suara-lang') ?? undefined, meter);

      if (req.method === 'POST' && path.endsWith('/turn/plan')) {
        return json(200, withCost(await planTurnHandler(turnDeps, { userId }), meter));
      }

      const attempt = path.match(/\/turn\/([^/]+)\/attempt$/);
      if (req.method === 'POST' && attempt) {
        const turnId = decodeURIComponent(attempt[1]!);
        const audio: AudioBlob = {
          bytes: new Uint8Array(await req.arrayBuffer()),
          mimeType: req.headers.get('content-type') ?? 'audio/wav',
        };
        return json(200, withCost(await attemptHandler(turnDeps, { turnId, audio }), meter));
      }

      return json(404, { error: 'not found' });
    } catch (e) {
      if (e instanceof UnauthorizedError) return json(401, { error: e.message });
      const msg = e instanceof Error ? e.message : String(e);
      if (/unknown or already-used turn/i.test(msg)) return json(409, { error: msg });
      return json(500, { error: msg });
    }
  };
}
