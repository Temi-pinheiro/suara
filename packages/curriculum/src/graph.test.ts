/**
 * Structural guard for EVERY language's curriculum seed (cmn, jpn, kor, hin, ind).
 * The ordering is the IP; a broken DAG (a prereq that points forward, a typo'd id,
 * an unreachable block) silently strands a learner. These checks are language-
 * agnostic — they run the same way for all five graphs, so adding a language only
 * adds data, never a special case.
 */

import { describe, expect, it } from 'vitest';
import type { LearnerState } from '@suara/core';
import { availableLanguages, loadComponents, loadCurriculum, loadModules } from './index';

const langs = availableLanguages();

function emptyState(lang: (typeof langs)[number], known: string[]): LearnerState {
  return { userId: 't', lang, known, mastery: {}, turnIndex: 0, lastTurns: [] };
}

describe('curriculum graphs (all languages)', () => {
  it('ships seeds for every supported language', () => {
    expect(langs).toEqual(expect.arrayContaining(['cmn', 'jpn', 'kor', 'hin', 'ind']));
  });

  for (const lang of langs) {
    describe(lang, () => {
      const components = loadComponents(lang);
      const ids = components.map((c) => c.id);
      const index = new Map(ids.map((id, i) => [id, i]));

      it('has a non-trivial graph with unique ids', () => {
        expect(components.length).toBeGreaterThanOrEqual(20);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('gives every block a surface and a gloss', () => {
        for (const c of components) {
          expect(c.surface.trim().length).toBeGreaterThan(0);
          expect(c.glossEn.trim().length).toBeGreaterThan(0);
          expect(c.lang).toBe(lang);
        }
      });

      it('only references prerequisites that exist and come earlier (acyclic, topo-ordered)', () => {
        for (const c of components) {
          for (const p of c.prereqIds) {
            expect(index.has(p)).toBe(true); // prereq exists in this language
            expect(index.get(p)!).toBeLessThan(index.get(c.id)!); // and is introduced before it
          }
        }
      });

      it('starts from at least one prereq-free root', () => {
        expect(components.some((c) => c.prereqIds.length === 0)).toBe(true);
      });

      it('is fully reachable from zero — no block is stranded behind its prereqs', () => {
        const graph = loadCurriculum(lang);
        const known = new Set<string>();
        // Unlock in waves until nothing new opens; a healthy DAG reaches every block.
        for (let guard = 0; guard <= components.length; guard++) {
          const wave = graph.nextUnlocked(emptyState(lang, [...known]));
          if (wave.length === 0) break;
          for (const c of wave) known.add(c.id);
        }
        expect(known.size).toBe(components.length);
      });

      // Modules are optional per language; when present they must tile the graph cleanly.
      const modules = loadModules(lang);
      if (modules.length > 0) {
        it('groups every component into exactly one module (no gaps, no overlaps)', () => {
          const seen = new Set<string>();
          for (const m of modules) {
            expect(m.title.trim().length).toBeGreaterThan(0);
            for (const cid of m.componentIds) {
              expect(index.has(cid)).toBe(true); // references a real component
              expect(seen.has(cid)).toBe(false); // no component in two modules
              seen.add(cid);
            }
          }
          expect(seen.size).toBe(ids.length); // every component is covered
        });
      }
    });
  }
});
