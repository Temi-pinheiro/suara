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
import type { LanguageConfig } from '@suara/core';
import { createTurnHandlerDeps } from '../src/prod';
import { createHttpHandler, devHeaderAuth } from '../src/http/handler';

try {
  process.loadEnvFile('../../.env');
} catch {
  /* ambient env */
}

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error('ELEVENLABS_API_KEY not set');
  process.exit(1);
}

const voicesRes = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } });
const voices = (await voicesRes.json()).voices as Array<{ voice_id: string; name: string }>;
const targetVoice = voices[0]!;
const l1Voice = voices[1] ?? voices[0]!;

const config: LanguageConfig = {
  code: 'cmn',
  l1: 'eng',
  phonology: 'tonal',
  toneInventory: ['1', '2', '3', '4', '0'],
  tts: { provider: 'elevenlabs', targetVoiceId: targetVoice.voice_id, l1VoiceId: l1Voice.voice_id },
  pronunciation: { mode: 'tone', provider: 'azure' },
};

const handle = createHttpHandler(createTurnHandlerDeps(config, process.env), { authenticate: devHeaderAuth });
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
  console.log(`Suara dev server → http://localhost:${PORT}  (cmn · tts voice "${targetVoice.name}" · azure tone)`);
  console.log('Point the client at it: EXPO_PUBLIC_SUARA_API=http://localhost:' + PORT);
});
