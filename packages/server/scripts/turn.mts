/**
 * Live end-to-end turn against real providers + your Supabase DB + R2.
 * Simulates the learner by synthesizing the correct target as 16 kHz WAV (so Azure
 * accepts it). Writes real rows (turns/mastery) + audio objects. Run from repo root:
 *
 *   pnpm turn            # uses a fresh demo-<timestamp> user each run
 *   pnpm turn alice      # use a fixed user id (progresses across runs)
 */

import process from 'node:process';
import { completeTurn, planTurn } from '@suara/core';
import type { AudioBlob } from '@suara/core';
import { createTurnHandlerDeps } from '../src/prod';
import { isSupportedLang, languageConfig } from '../src/config/languages';
import { pcmToWav } from '../src/audio/wav';
import { UsageMeter } from '../src/cost/meter';
import { estimateCost } from '../src/cost/pricing';

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
const USER = process.argv[2] ?? `demo-${Date.now()}`;
const LANG = process.env.SUARA_LANG ?? 'cmn';
if (!isSupportedLang(LANG)) {
  console.error(`SUARA_LANG="${LANG}" is not one of cmn, jpn, kor, hin, ind`);
  process.exit(1);
}

async function fetchVoices(): Promise<Array<{ voice_id: string; name: string }>> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY! } });
  if (!res.ok) throw new Error(`GET /v1/voices ${res.status}`);
  return (await res.json()).voices;
}

/** Synthesize text as headerless 16 kHz PCM, then wrap it in a WAV container. */
async function learnerWav(text: string, voiceId: string): Promise<AudioBlob> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_16000`,
    {
      method: 'POST',
      headers: { 'xi-api-key': KEY!, 'content-type': 'application/json', accept: 'audio/pcm' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    },
  );
  if (!res.ok) throw new Error(`learner TTS ${res.status}: ${await res.text()}`);
  const pcm = new Uint8Array(await res.arrayBuffer());
  return { bytes: pcmToWav(pcm), mimeType: 'audio/wav' };
}

const voices = await fetchVoices();
const targetVoice = voices[0]!.voice_id;
const l1Voice = voices[1]?.voice_id ?? targetVoice;

const config = languageConfig(LANG, { targetVoiceId: targetVoice, l1VoiceId: l1Voice });

const meter = new UsageMeter();
const { deps } = createTurnHandlerDeps(config, process.env, { meter });

console.log(`\n=== Suara live turn — user "${USER}" · ${config.code} (${config.pronunciation.mode}) ===\n`);

// PLAN + PROMPT — real brain picks the next block; TTS uploads the setup to R2.
const plan = await planTurn(deps, USER);
console.log('PLAN / PROMPT');
console.log('  setup     :', plan.decision.englishSetup);
console.log('  target    :', plan.decision.targetUtterance.surface, `(ref: ${plan.decision.referenceText})`);
console.log('  setup → R2 :', plan.promptAudio.setup.url);

// CAPTURE — the learner "speaks" the target correctly, as 16 kHz WAV.
const audio = await learnerWav(plan.decision.referenceText, targetVoice);
console.log(`\nCAPTURE     ${audio.bytes.length} bytes WAV\n`);

// SCORE (ASR ∥ Azure) → REACT (brain) → SPEAK (TTS) → PERSIST (Drizzle).
const result = await completeTurn(deps, {
  userId: USER,
  decision: plan.decision,
  ctx: plan.ctx,
  audio,
});
console.log('SCORE');
console.log('  transcript :', result.transcript);
console.log(
  '  pron       :',
  result.pronScore?.overall,
  '·',
  result.pronScore?.perSyllable.map((s) => `${s.unit}:${s.score}`).join(' '),
);
console.log('REACT');
console.log('  verdict    :', result.feedback.verdict, '→', result.feedback.decision);
console.log('  correction :', result.feedback.correction);
console.log('SPEAK');
console.log('  model → R2 :', result.modelAudio.url);

const state = await deps.store.getState(USER, config.code);
console.log('\nPERSIST (read back from Supabase)');
console.log('  known      :', state.known);
console.log('  turnIndex  :', state.turnIndex);

const cost = estimateCost(meter.usage);
console.log('\nCOST (this turn, approx)');
console.log('  tts        :', meter.usage.ttsCalls, 'calls /', meter.usage.ttsChars, 'chars');
console.log('  asr / pron :', meter.usage.asrCalls, '/', meter.usage.pronCalls, 'calls');
console.log('  llm        :', JSON.stringify(meter.usage.llm));
console.log(
  '  estimate   : $' + cost.totalUsd.toFixed(4),
  `(llm $${cost.llmUsd.toFixed(4)} · tts $${cost.ttsUsd.toFixed(4)} · asr $${cost.asrUsd.toFixed(4)} · pron $${cost.pronUsd.toFixed(4)})`,
);

console.log('\n✅ live turn complete\n');
process.exit(0);
