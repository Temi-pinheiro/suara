/**
 * Local dev server: mounts the Web HTTP handler on Node's http server so the Expo
 * client can hit a real backend (real providers + Supabase + R2). Run from root:
 *
 *   pnpm serve            # http://localhost:8787
 *
 * Point the client at it: EXPO_PUBLIC_SUARA_API=http://localhost:8787
 * Production deploys the same createHttpHandler in a Supabase Edge Function instead.
 */

import { createServer } from 'node:http';
import process from 'node:process';
import { createLanguageRouter, unquote } from '../src/prod';
import { isSupportedLang } from '../src/config/languages';
import { createHttpHandler, devHeaderAuth } from '../src/http/handler';
import { createRateLimiterFromEnv } from '../src/cost/rateLimit';

const cleanEnv = (k: string): string | undefined => {
  const v = process.env[k];
  return v ? unquote(v) : undefined;
};

try {
  process.loadEnvFile('../../.env');
} catch {
  /* ambient env */
}

const KEY = cleanEnv('ELEVENLABS_API_KEY');
if (!KEY) {
  console.error('ELEVENLABS_API_KEY not set');
  process.exit(1);
}

const LANG = cleanEnv('SUARA_LANG') ?? 'cmn'; // default when the client sends no x-suara-lang
if (!isSupportedLang(LANG)) {
  console.error(`SUARA_LANG="${LANG}" is not one of cmn, jpn, kor, hin, ind`);
  process.exit(1);
}

// Prefer env-pinned voice ids (SUARA_TARGET_VOICE_ID / SUARA_L1_VOICE_ID) — a deployed
// host shouldn't depend on the ElevenLabs voices endpoint at boot, and pinning keeps the
// voice matching the pre-generated audio cache. Fall back to the live voice list locally.
let targetVoiceId = cleanEnv('SUARA_TARGET_VOICE_ID');
let l1VoiceId = cleanEnv('SUARA_L1_VOICE_ID');
let voiceLabel = 'env-pinned';
if (!targetVoiceId || !l1VoiceId) {
  const voices = (await (await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } })).json())
    .voices as Array<{ voice_id: string; name: string }>;
  targetVoiceId = targetVoiceId ?? voices[0]!.voice_id;
  l1VoiceId = l1VoiceId ?? voices[1]?.voice_id ?? voices[0]!.voice_id;
  voiceLabel = voices[0]!.name;
}

// All five languages are switchable per request (the client's x-suara-lang header);
// LANG is just the default when none is sent.
const router = createLanguageRouter(process.env, { targetVoiceId, l1VoiceId }, { defaultLang: LANG });

const limiter = createRateLimiterFromEnv(process.env);
const handle = createHttpHandler((lang, meter) => router.resolve(lang, meter), {
  authenticate: devHeaderAuth,
  rateLimit: (userId) => limiter.check(userId),
});
const PORT = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(','));
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && body.length > 0;
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: hasBody ? body : undefined,
    });

    const response = await handle(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  }
}).listen(PORT, () => {
  console.log(
    `Suara server → :${PORT}  (default ${LANG} · all five switchable via x-suara-lang · voice ${voiceLabel})`,
  );
  console.log('Point the client at it: EXPO_PUBLIC_SUARA_API=http://localhost:' + PORT);
});
