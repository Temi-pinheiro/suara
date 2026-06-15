import type { ComponentKind, LangCode } from '@suara/core';

/** Raw seed shape (snake_case, matches the `components` table + JSON seeds). */
export interface ComponentSeed {
  id: string;
  kind: ComponentKind;
  surface: string;
  gloss_en: string;
  expected_tones?: string | null;
  prereq_ids: string[];
  recomb_hint?: string;
}

export interface LanguageSeed {
  lang: LangCode;
  components: ComponentSeed[];
}
