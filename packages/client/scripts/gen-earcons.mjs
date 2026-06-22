/**
 * Generates Suara's earcons — the short audio cues that carry lesson state for an
 * eyes-closed learner (the visual UI is optional). Warm and musical, never a buzzer:
 * MT tone is gentle, so even "try again" resolves softly, never punitively.
 *
 *   node scripts/gen-earcons.mjs   →  assets/earcons/{your-turn,thinking,got-it,again,done}.wav
 *
 * Pure Node: we render sine tones with a click-free envelope and hand-encode 16-bit
 * mono PCM WAV. Re-run to retune.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'earcons');
const RATE = 44_100;

// Equal-tempered note frequencies (Hz) we compose from.
const N = { D4: 293.66, A4: 440.0, C5: 523.25, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5 };

/** One note: a sine at `freq`, starting at `start`s for `dur`s, soft attack + decay. */
function note(freq, start, dur, gain = 0.5) {
  return { freq, start, dur, gain };
}

/** Render notes → Float32 buffer with a 8ms attack and exponential decay (no clicks). */
function render(notes) {
  const end = Math.max(...notes.map((n) => n.start + n.dur));
  const len = Math.ceil((end + 0.05) * RATE);
  const buf = new Float32Array(len);
  const attack = 0.008;
  for (const n of notes) {
    const s0 = Math.floor(n.start * RATE);
    const ns = Math.floor(n.dur * RATE);
    for (let i = 0; i < ns; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / attack) * Math.exp(-3.2 * (t / n.dur)); // gentle bell decay
      buf[s0 + i] += Math.sin(2 * Math.PI * n.freq * t) * n.gain * env;
    }
  }
  // Soft-clip guard so summed notes never wrap.
  for (let i = 0; i < len; i++) buf[i] = Math.tanh(buf[i]);
  return buf;
}

function encodeWav(float) {
  const data = Buffer.alloc(float.length * 2);
  for (let i = 0; i < float.length; i++) {
    const s = Math.max(-1, Math.min(1, float[i]));
    data.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits/sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// The cue vocabulary. Rising = "go" (your turn); resolved triad = warm/done.
const EARCONS = {
  // Your turn — two quick ascending notes, an inviting "over to you".
  'your-turn': [note(N.A4, 0, 0.16, 0.5), note(N.E5, 0.13, 0.32, 0.5)],
  // Thinking — one soft low note while scoring, so silence never feels like a freeze.
  thinking: [note(N.D4, 0, 0.42, 0.32)],
  // Got it — a bright rising fifth, encouraging without being a "ding you won" jingle.
  'got-it': [note(N.C5, 0, 0.18, 0.46), note(N.G5, 0.15, 0.4, 0.46)],
  // Try again — a gentle settle DOWN a step (warm, never a buzzer): "let's go round once more".
  again: [note(N.E5, 0, 0.18, 0.42), note(N.C5, 0.16, 0.4, 0.42)],
  // Done — a soft resolved triad arpeggio to close the session.
  done: [note(N.C5, 0, 0.5, 0.4), note(N.E5, 0.12, 0.5, 0.38), note(N.G5, 0.24, 0.6, 0.36)],
};

mkdirSync(OUT, { recursive: true });
console.log('Generating earcons →', OUT);
for (const [name, notes] of Object.entries(EARCONS)) {
  const wav = encodeWav(render(notes));
  writeFileSync(join(OUT, `${name}.wav`), wav);
  console.log(`  ${name}.wav  ${wav.length}b`);
}
console.log('Done.');
