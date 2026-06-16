/**
 * Live key/connectivity smoke test. Pings each real provider with a minimal call
 * and prints PASS/FAIL — never prints secret values. Run from the repo root:
 *
 *   pnpm smoke            # (tsx packages/server/scripts/smoke.mts)
 *
 * Costs a few fractions of a cent (one tiny Claude call + one short TTS line).
 */

import process from 'node:process';
import Anthropic from '@anthropic-ai/sdk';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import postgres from 'postgres';
import {
  AzureProvider,
  ElevenLabsTTSProvider,
  ScribeASRProvider,
  type ObjectStore,
} from '@suara/providers';

// Load .env from the repo root (Node 22 builtin).
try {
  process.loadEnvFile();
} catch {
  console.error('⚠️  no .env found in the current directory — run from the repo root');
}

interface Result {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
}
const results: Result[] = [];

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

async function check(name: string, requiredKeys: string[], fn: () => Promise<string>): Promise<void> {
  const missing = requiredKeys.filter((k) => !env(k));
  if (missing.length > 0) {
    results.push({ name, status: 'skip', detail: `missing ${missing.join(', ')}` });
    return;
  }
  try {
    const detail = await fn();
    results.push({ name, status: 'pass', detail });
  } catch (e) {
    results.push({ name, status: 'fail', detail: e instanceof Error ? e.message : String(e) });
  }
}

/** Captures the bytes the TTS provider stores, so we can feed them to ASR. */
class CapturingStore implements ObjectStore {
  public last: Uint8Array | null = null;
  async exists(): Promise<boolean> {
    return false;
  }
  async put(_key: string, bytes: Uint8Array): Promise<void> {
    this.last = bytes;
  }
  url(key: string): string {
    return `mem://${key}`;
  }
}

await check('Anthropic (brain)', ['ANTHROPIC_API_KEY'], async () => {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
  });
  const text = msg.content.find((b) => b.type === 'text');
  return `model=${msg.model}, reply="${text && 'text' in text ? text.text.trim() : ''}"`;
});

const store = new CapturingStore();
let voiceId = '';
await check('ElevenLabs TTS', ['ELEVENLABS_API_KEY'], async () => {
  const key = env('ELEVENLABS_API_KEY')!;
  const vres = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
  if (!vres.ok) throw new Error(`GET /v1/voices ${vres.status}: ${await vres.text()}`);
  const voices = (await vres.json()).voices as Array<{ voice_id: string; name: string }>;
  if (!voices?.length) throw new Error('account has no voices');
  voiceId = voices[0]!.voice_id;
  const tts = new ElevenLabsTTSProvider({ apiKey: key, store });
  const ref = await tts.synth('你好', voiceId, 'cmn');
  return `voice="${voices[0]!.name}", cached ${store.last?.length ?? 0} bytes → ${ref.url}`;
});

await check('ElevenLabs Scribe (ASR)', ['ELEVENLABS_API_KEY'], async () => {
  if (!store.last) throw new Error('no TTS audio to transcribe (TTS step failed)');
  const asr = new ScribeASRProvider({ apiKey: env('ELEVENLABS_API_KEY')! });
  const { text } = await asr.transcribe({ bytes: store.last, mimeType: 'audio/mpeg' }, 'cmn');
  return `transcript="${text}"`;
});

await check('Azure (pronunciation key)', ['AZURE_SPEECH_KEY', 'AZURE_REGION'], async () => {
  // Validate key+region via issueToken (no audio-format requirements).
  const region = env('AZURE_REGION')!;
  const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': env('AZURE_SPEECH_KEY')!, 'Content-Length': '0' },
  });
  if (!res.ok) throw new Error(`issueToken ${res.status}: ${await res.text()}`);
  const token = await res.text();
  return `region=${region}, token issued (${token.length} chars)`;
});

await check('Supabase Postgres', ['DATABASE_URL'], async () => {
  const sql = postgres(env('DATABASE_URL')!, { ssl: 'require', prepare: false, max: 1 });
  try {
    const rows = await sql`select 1 as ok`;
    return `select 1 → ${rows[0]?.ok}`;
  } finally {
    await sql.end({ timeout: 5 });
  }
});

await check(
  'Cloudflare R2',
  ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'],
  async () => {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${env('R2_ACCOUNT_ID')!}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env('R2_ACCESS_KEY_ID')!,
        secretAccessKey: env('R2_SECRET_ACCESS_KEY')!,
      },
    });
    const Bucket = env('R2_BUCKET')!;
    const Key = 'suara/smoke-test.txt';
    await client.send(
      new PutObjectCommand({ Bucket, Key, Body: 'ok', ContentType: 'text/plain' }),
    );
    await client.send(new HeadObjectCommand({ Bucket, Key }));
    return `put+head ${Bucket}/${Key} ok`;
  },
);

// --- report ---
const icon = { pass: '✅', fail: '❌', skip: '⚪️' } as const;
console.log('\nSuara — live smoke test\n');
for (const r of results) {
  console.log(`${icon[r.status]}  ${r.name.padEnd(28)} ${r.detail}`);
}
const failed = results.filter((r) => r.status === 'fail').length;
const passed = results.filter((r) => r.status === 'pass').length;
console.log(`\n${passed} passed, ${failed} failed, ${results.length - passed - failed} skipped\n`);
process.exit(failed > 0 ? 1 : 0);
