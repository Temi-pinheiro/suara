/**
 * Offline batch: pre-generate component audio for a language into R2 and write the
 * refs back to the `components` table. Idempotent (cached lines are skipped). Run:
 *
 *   pnpm gen:audio          # cmn
 *   pnpm gen:audio cmn
 */

import process from 'node:process';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadComponents } from '@suara/curriculum';
import { ElevenLabsTTSProvider } from '@suara/providers';
import { isSupportedLang, languageConfig } from '../src/config/languages';
import { pregenerateComponentAudio } from '../src/audio/pregenerate';
import { components } from '../src/db/schema';
import { R2ObjectStore } from '../src/storage/r2';

try {
  process.loadEnvFile('../../.env');
} catch {
  /* ambient env */
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`${key} not set`);
    process.exit(1);
  }
  return v;
}

const lang = process.argv[2] ?? 'cmn';
if (!isSupportedLang(lang)) {
  console.error(`usage: pnpm gen:audio [cmn|jpn|kor|hin|ind] — got "${lang}"`);
  process.exit(1);
}
const elevenKey = required('ELEVENLABS_API_KEY');

const voices = (await (await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': elevenKey } })).json())
  .voices as Array<{ voice_id: string; name: string }>;
const targetVoice = voices[0]!;

const store = new R2ObjectStore({
  accountId: required('R2_ACCOUNT_ID'),
  accessKeyId: required('R2_ACCESS_KEY_ID'),
  secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  bucket: required('R2_BUCKET'),
  publicBaseUrl: required('R2_PUBLIC_BASE_URL'),
});
const tts = new ElevenLabsTTSProvider({ apiKey: elevenKey, store });

const config = languageConfig(lang, {
  targetVoiceId: targetVoice.voice_id,
  l1VoiceId: targetVoice.voice_id,
});

const comps = loadComponents(lang);
console.log(`Pre-generating audio for ${comps.length} ${lang} components (voice "${targetVoice.name}")…`);

const results = await pregenerateComponentAudio({ components: comps, tts, config });

const sql = postgres(required('DATABASE_URL'), { ssl: 'require', prepare: false, max: 1 });
const db = drizzle(sql);
for (const r of results) {
  await db.update(components).set({ introAudioRef: r.introAudioUrl }).where(eq(components.id, r.componentId));
}
await sql.end({ timeout: 5 });

console.log(`Done — wrote intro_audio_ref for ${results.length} components (R2 + DB).`);
process.exit(0);
