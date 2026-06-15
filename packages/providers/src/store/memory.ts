import { applyTurnOutcome } from '@suara/core';
import type { LangCode, LearnerState, LearnerStore, TurnRecord } from '@suara/core';

/**
 * In-memory LearnerStore for Phase 0 + tests. The real implementation (Supabase
 * Postgres + Drizzle) lands in packages/server; it implements the same interface.
 * recordTurn applies the invisible SRS via @suara/core, keeping the store the
 * single source of truth for learner state.
 */
export class InMemoryLearnerStore implements LearnerStore {
  private readonly states = new Map<string, LearnerState>();
  public readonly turns: TurnRecord[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  private key(userId: string, lang: LangCode): string {
    return `${userId}:${lang}`;
  }

  private fresh(userId: string, lang: LangCode): LearnerState {
    return { userId, lang, known: [], mastery: {}, turnIndex: 0, lastTurns: [] };
  }

  async getState(userId: string, lang: LangCode): Promise<LearnerState> {
    const existing = this.states.get(this.key(userId, lang));
    return structuredClone(existing ?? this.fresh(userId, lang));
  }

  async recordTurn(userId: string, lang: LangCode, t: TurnRecord): Promise<void> {
    this.turns.push(t);
    const k = this.key(userId, lang);
    const prev = this.states.get(k) ?? this.fresh(userId, lang);
    const updated = applyTurnOutcome(
      prev,
      { focusComponentId: t.componentId, masteryDelta: t.masteryDelta, outcome: t.decision },
      this.now(),
    );
    updated.lastTurns = [...prev.lastTurns, `${t.componentId}:${t.decision}`].slice(-5);
    this.states.set(k, updated);
  }

  /** Test helper: seed learner state directly. */
  seed(state: LearnerState): void {
    this.states.set(this.key(state.userId, state.lang), structuredClone(state));
  }
}
