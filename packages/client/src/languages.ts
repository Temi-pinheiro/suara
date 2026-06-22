/**
 * The five supported languages, for the picker + display. The client sends the
 * `code` to the server (x-suara-lang) to pick the lesson language at runtime.
 * Mirrors @suara/core's LangCode without importing the engine into the client.
 */

export type LangCode = 'cmn' | 'jpn' | 'kor' | 'hin' | 'ind';

export interface Language {
  code: LangCode;
  name: string;
  /** two-letter badge shown in the picker / entry pill */
  badge: string;
}

export const LANGUAGES: Language[] = [
  { code: 'cmn', name: 'Mandarin', badge: 'ZH' },
  { code: 'jpn', name: 'Japanese', badge: 'JA' },
  { code: 'kor', name: 'Korean', badge: 'KO' },
  { code: 'hin', name: 'Hindi', badge: 'HI' },
  { code: 'ind', name: 'Indonesian', badge: 'ID' },
];

export function languageByCode(code: LangCode): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}
