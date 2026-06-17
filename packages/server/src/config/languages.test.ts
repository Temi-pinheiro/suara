import { describe, expect, it } from 'vitest';
import { isSupportedLang, languageConfig, SUPPORTED_LANGS } from './languages';

const voices = { targetVoiceId: 'v-target', l1VoiceId: 'v-l1' };

describe('languageConfig', () => {
  it('routes each language to the right pronunciation mode', () => {
    const modes = Object.fromEntries(
      SUPPORTED_LANGS.map((l) => [l, languageConfig(l, voices).pronunciation.mode]),
    );
    expect(modes).toEqual({
      cmn: 'tone',
      jpn: 'segmental',
      kor: 'segmental',
      hin: 'segmental',
      ind: 'coached',
    });
  });

  it('gives Mandarin tone scoring + a tone inventory', () => {
    const c = languageConfig('cmn', voices);
    expect(c.phonology).toBe('tonal');
    expect(c.pronunciation).toEqual({ mode: 'tone', provider: 'azure' });
    expect(c.toneInventory).toEqual(['1', '2', '3', '4', '0']);
  });

  it('gives the segmental languages an Azure scorer and no tone inventory', () => {
    for (const l of ['jpn', 'kor', 'hin'] as const) {
      const c = languageConfig(l, voices);
      expect(c.pronunciation).toEqual({ mode: 'segmental', provider: 'azure' });
      expect(c.toneInventory).toBeUndefined();
    }
  });

  it('gives Indonesian coached mode with NO scoring vendor', () => {
    const c = languageConfig('ind', voices);
    expect(c.phonology).toBe('non-tonal');
    expect(c.pronunciation).toEqual({ mode: 'coached' });
    expect(c.pronunciation.provider).toBeUndefined();
  });

  it('keeps classmates off by default and opt-in only', () => {
    expect(languageConfig('cmn', voices).classmates).toBeUndefined();
    const withMates = languageConfig(
      'cmn',
      { ...voices, classmateVoiceIds: ['v-mate'] },
      { classmates: true },
    );
    expect(withMates.classmates).toBe(true);
    expect(withMates.tts.classmateVoiceIds).toEqual(['v-mate']);
  });

  it('recognizes exactly the five supported languages', () => {
    expect(SUPPORTED_LANGS).toEqual(['cmn', 'jpn', 'kor', 'hin', 'ind']);
    expect(isSupportedLang('cmn')).toBe(true);
    expect(isSupportedLang('fra')).toBe(false);
  });
});
