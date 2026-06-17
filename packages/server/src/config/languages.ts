/**
 * The five LanguageConfigs in one place. Each is just data: phonology + the
 * pronunciation MODE (tone / segmental / coached) the engine routes on. The brain,
 * turn lifecycle, TTS/ASR and `prod.ts`'s provider selection are all language-
 * agnostic, so this table is the ONLY thing that changes per language — the
 * zero-`core`-diff acceptance test (PLAN.md §10, Phase 3).
 *
 * Voice ids are injected (resolved from ElevenLabs at runtime); the multilingual
 * voice model speaks all five, so one target + one L1 voice covers everything.
 */

import type { LangCode, LanguageConfig, Phonology, PronMode } from '@suara/core';

export const SUPPORTED_LANGS: readonly LangCode[] = ['cmn', 'jpn', 'kor', 'hin', 'ind'];

interface LangProfile {
  phonology: Phonology;
  mode: PronMode;
  /** scoring vendor; omitted for `coached` (Indonesian has no vendor by design) */
  provider?: string;
  /** cmn only */
  toneInventory?: string[];
}

const PROFILES: Record<LangCode, LangProfile> = {
  cmn: { phonology: 'tonal', mode: 'tone', provider: 'azure', toneInventory: ['1', '2', '3', '4', '0'] },
  jpn: { phonology: 'pitch-accent', mode: 'segmental', provider: 'azure' },
  kor: { phonology: 'non-tonal', mode: 'segmental', provider: 'azure' },
  hin: { phonology: 'non-tonal', mode: 'segmental', provider: 'azure' },
  ind: { phonology: 'non-tonal', mode: 'coached' },
};

export interface VoiceIds {
  targetVoiceId: string;
  l1VoiceId: string;
  classmateVoiceIds?: string[];
}

export function isSupportedLang(code: string): code is LangCode {
  return (SUPPORTED_LANGS as readonly string[]).includes(code);
}

/** Build the LanguageConfig for `code` from runtime voice ids. Pure data assembly. */
export function languageConfig(
  code: LangCode,
  voices: VoiceIds,
  opts: { classmates?: boolean } = {},
): LanguageConfig {
  const p = PROFILES[code];

  const tts: LanguageConfig['tts'] = {
    provider: 'elevenlabs',
    targetVoiceId: voices.targetVoiceId,
    l1VoiceId: voices.l1VoiceId,
    ...(voices.classmateVoiceIds ? { classmateVoiceIds: voices.classmateVoiceIds } : {}),
  };

  const pronunciation: LanguageConfig['pronunciation'] =
    p.provider ? { mode: p.mode, provider: p.provider } : { mode: p.mode };

  const config: LanguageConfig = { code, l1: 'eng', phonology: p.phonology, tts, pronunciation };
  if (p.toneInventory) config.toneInventory = p.toneInventory;
  if (opts.classmates) config.classmates = true;
  return config;
}
