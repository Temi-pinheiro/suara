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

/** A small functional grouping of components — the unit shown on the path overview. */
export interface ModuleSeed {
  id: string;
  /** warm, human title (e.g. "I want a drink") — never "Level 3" */
  title: string;
  componentIds: string[];
}

export interface LanguageSeed {
  lang: LangCode;
  components: ComponentSeed[];
  /** optional: groups the components into path modules (cmn authored first) */
  modules?: ModuleSeed[];
}
