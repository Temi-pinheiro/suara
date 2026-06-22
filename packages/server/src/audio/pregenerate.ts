/**
 * Pre-generate the cacheable TTS for a language: each component's surface (the block
 * modeled on an introduce turn) synthesized in the target voice. Runs offline as a
 * batch (scripts/gen-audio.mts), so runtime turns hit the R2 cache instead of paying
 * ElevenLabs on the hot path (PLAN.md §8). Idempotent through the provider's
 * content-hash cache — only new lines hit the vendor.
 *
 * The dynamic per-turn lines (the brain's English setup, the model answer) can't be
 * pre-generated; the component surfaces are the high-value, reusable ones.
 */

import { splitSurface } from '@suara/core';
import type { Component, LanguageConfig, TTSProvider } from '@suara/core';

export interface PregeneratedAudio {
  componentId: string;
  text: string;
  introAudioUrl: string;
}

export async function pregenerateComponentAudio(opts: {
  components: Component[];
  tts: TTSProvider;
  config: LanguageConfig;
}): Promise<PregeneratedAudio[]> {
  const out: PregeneratedAudio[] = [];
  for (const c of opts.components) {
    const { surface } = splitSurface(c.surface);
    const ref = await opts.tts.synth(surface, opts.config.tts.targetVoiceId, opts.config.code);
    out.push({ componentId: c.id, text: surface, introAudioUrl: ref.url ?? '' });
  }
  return out;
}
