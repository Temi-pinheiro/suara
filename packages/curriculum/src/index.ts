/**
 * @suara/curriculum — per-language component graphs (the pedagogical IP).
 * One seed file per language, shared schema. Mandarin (cmn) ships first.
 */

import type { Component, LangCode } from '@suara/core';
import type { ModuleSeed } from './types';
// JSON import attributes keep these resolvable under Deno (the Supabase Edge runtime)
// as well as esbuild/tsx/Node — needed so @suara/curriculum bundles into the edge fn.
import cmnStarter from '../data/cmn-starter.json' with { type: 'json' };
import jpnStarter from '../data/jpn-starter.json' with { type: 'json' };
import korStarter from '../data/kor-starter.json' with { type: 'json' };
import hinStarter from '../data/hin-starter.json' with { type: 'json' };
import indStarter from '../data/ind-starter.json' with { type: 'json' };
import { DagCurriculumGraph } from './graph';
import type { ComponentSeed, LanguageSeed } from './types';

export * from './types';
export { DagCurriculumGraph } from './graph';

// One seed file per language, shared schema. Adding a language is a data change
// here — zero diffs in @suara/core (the language-agnostic-engine acceptance test).
const SEEDS: Partial<Record<LangCode, LanguageSeed>> = {
  cmn: cmnStarter as LanguageSeed,
  jpn: jpnStarter as LanguageSeed,
  kor: korStarter as LanguageSeed,
  hin: hinStarter as LanguageSeed,
  ind: indStarter as LanguageSeed,
};

function fromSeed(s: ComponentSeed, lang: LangCode): Component {
  return {
    id: s.id,
    lang,
    kind: s.kind,
    surface: s.surface,
    glossEn: s.gloss_en,
    // The starter seed carries the recombination hint; the expert-reviewed graph
    // (Phase 2) will add explicit generative rules. Until then it doubles as both.
    rule: s.recomb_hint,
    expectedTones: s.expected_tones ?? null,
    prereqIds: s.prereq_ids,
    recombHint: s.recomb_hint,
  };
}

export function loadComponents(lang: LangCode): Component[] {
  const seed = SEEDS[lang];
  if (!seed) throw new Error(`no curriculum seed for language: ${lang}`);
  return seed.components.map((s) => fromSeed(s, lang));
}

export function loadCurriculum(lang: LangCode, clock?: () => number): DagCurriculumGraph {
  return new DagCurriculumGraph(loadComponents(lang), clock);
}

export function availableLanguages(): LangCode[] {
  return Object.keys(SEEDS) as LangCode[];
}

/** Path modules for a language (the overview grouping). Empty when none are authored. */
export function loadModules(lang: LangCode): ModuleSeed[] {
  return SEEDS[lang]?.modules ?? [];
}
