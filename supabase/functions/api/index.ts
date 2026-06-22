/**
 * Suara turn API — Supabase Edge Function (Deno).
 *
 * Reuses the SAME composition root as the Node dev server (scripts/serve.mts):
 * createLanguageRouter -> createHttpHandler. The handler is framework-agnostic
 * (Web Request -> Response), so Deno.serve can mount it directly.
 *
 * Routes (function mounted at /functions/v1/api):
 *   GET  /functions/v1/api/path                  -> path overview
 *   POST /functions/v1/api/turn/plan             -> next prompt
 *   POST /functions/v1/api/turn/{turnId}/attempt -> scored attempt (audio body)
 *
 * Auth: our own anonymous x-user-id (devHeaderAuth) — NOT Supabase's JWT gate, so
 * deploy with `--no-verify-jwt`. Cost guardrails (server/src/cost) protect the open
 * endpoint. Secrets come from `supabase secrets set` and are read here from the env.
 *
 * Voice ids are env-provided (no per-cold-start ElevenLabs fetch):
 *   SUARA_TARGET_VOICE_ID, SUARA_L1_VOICE_ID
 *
 * See docs/deploy.md for the full runbook (import map, secrets, pooled DATABASE_URL).
 */

import process from 'node:process';
import { createLanguageRouter } from '../../../packages/server/src/prod.ts';
import { createHttpHandler, devHeaderAuth } from '../../../packages/server/src/http/handler.ts';
import { createRateLimiterFromEnv } from '../../../packages/server/src/cost/rateLimit.ts';

const env = process.env as Record<string, string | undefined>;

const targetVoiceId = env.SUARA_TARGET_VOICE_ID;
const l1VoiceId = env.SUARA_L1_VOICE_ID;
if (!targetVoiceId || !l1VoiceId) {
  throw new Error('SUARA_TARGET_VOICE_ID and SUARA_L1_VOICE_ID must be set (supabase secrets set …)');
}

const defaultLang = (env.SUARA_LANG ?? 'cmn') as 'cmn' | 'jpn' | 'kor' | 'ind' | 'hin';

// Built once per isolate; per-language deps + the per-request meter are resolved inside.
const router = createLanguageRouter(env, { targetVoiceId, l1VoiceId }, { defaultLang });

const limiter = createRateLimiterFromEnv(env);
const handle = createHttpHandler((lang, meter) => router.resolve(lang, meter), {
  authenticate: devHeaderAuth, // anonymous device id in x-user-id
  rateLimit: (userId) => limiter.check(userId),
});

Deno.serve(handle);
