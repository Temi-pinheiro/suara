/**
 * DAG-backed CurriculumGraph. The ordering is the IP; this just enforces it:
 * a block is unlocked only when ALL its prereqs are known, and recombination
 * targets come straight from the invisible SRS (due, known blocks).
 */

import type { Component, CurriculumGraph, LearnerState } from '@suara/core';
import { selectDueTargets } from '@suara/core';

export class DagCurriculumGraph implements CurriculumGraph {
  private readonly byId: Map<string, Component>;
  private readonly ordered: Component[];

  constructor(
    components: Component[],
    private readonly clock: () => number = Date.now,
  ) {
    this.ordered = components;
    this.byId = new Map(components.map((c) => [c.id, c]));
  }

  /** Not-yet-known blocks whose prerequisites are all satisfied, in seed order. */
  nextUnlocked(state: LearnerState): Component[] {
    const known = new Set(state.known);
    return this.ordered.filter(
      (c) => !known.has(c.id) && c.prereqIds.every((p) => known.has(p)),
    );
  }

  /** SRS-driven, invisible: due + known blocks to weave into the next build. */
  recombinationTargets(state: LearnerState): Component[] {
    const now = this.clock();
    return selectDueTargets(state, now)
      .map((r) => this.byId.get(r.componentId))
      .filter((c): c is Component => c !== undefined);
  }

  get all(): readonly Component[] {
    return this.ordered;
  }

  get(id: string): Component | undefined {
    return this.byId.get(id);
  }

  getOrThrow(id: string): Component {
    const c = this.byId.get(id);
    if (!c) throw new Error(`unknown component: ${id}`);
    return c;
  }
}
