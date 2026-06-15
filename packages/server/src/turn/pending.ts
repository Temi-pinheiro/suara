/**
 * Pending-turn store: holds the in-flight TurnDecision + context between the two
 * HTTP calls of one turn (plan, then attempt — the learner records in between).
 * Single-use: `take` returns and removes. Pure interface; the Drizzle impl lives
 * in db/pendingStore.ts so this module (used by tests) stays free of pg deps.
 */

import type { LangCode, TurnContext, TurnDecision } from '@suara/core';

export interface PendingTurn {
  turnId: string;
  userId: string;
  lang: LangCode;
  decision: TurnDecision;
  ctx: TurnContext;
  createdAt: number;
}

export interface PendingTurnStore {
  put(p: PendingTurn): Promise<void>;
  /** get + remove (single use) */
  take(turnId: string): Promise<PendingTurn | null>;
}

export class InMemoryPendingTurnStore implements PendingTurnStore {
  private readonly map = new Map<string, PendingTurn>();

  async put(p: PendingTurn): Promise<void> {
    this.map.set(p.turnId, p);
  }

  async take(turnId: string): Promise<PendingTurn | null> {
    const p = this.map.get(turnId) ?? null;
    if (p) this.map.delete(turnId);
    return p;
  }
}
