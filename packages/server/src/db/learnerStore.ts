/**
 * DrizzleLearnerStore — the production LearnerStore (Supabase Postgres).
 *
 * Reuses the tested core SRS (`applyTurnOutcome`) for the read-modify-write of
 * mastery, so persisted scheduling matches the in-memory store exactly. Not
 * exercised in CI (no live DB); the turn logic is tested against the in-memory
 * store + mocks, per "no live calls in CI".
 */

import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { applyTurnOutcome } from '@suara/core';
import type { LangCode, LearnerState, LearnerStore, MasteryRecord, TurnRecord } from '@suara/core';
import type { Db } from './client';
import { errorLog, mastery, turns } from './schema';

export class DrizzleLearnerStore implements LearnerStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async getState(userId: string, lang: LangCode): Promise<LearnerState> {
    const masteryRows = await this.db
      .select()
      .from(mastery)
      .where(and(eq(mastery.userId, userId), eq(mastery.lang, lang)));

    const masteryMap: Record<string, MasteryRecord> = {};
    const known: string[] = [];
    for (const r of masteryRows) {
      masteryMap[r.componentId] = {
        componentId: r.componentId,
        strength: r.strength,
        lastSeen: r.lastSeen,
        dueAt: r.dueAt,
      };
      if (r.known) known.push(r.componentId);
    }

    const turnRows = await this.db
      .select({ componentId: turns.componentId, decision: turns.decision, ts: turns.ts })
      .from(turns)
      .where(and(eq(turns.userId, userId), eq(turns.lang, lang)));

    turnRows.sort((a, b) => a.ts - b.ts);
    const lastTurns = turnRows.slice(-5).map((t) => `${t.componentId}:${t.decision}`);

    return { userId, lang, known, mastery: masteryMap, turnIndex: turnRows.length, lastTurns };
  }

  async recordTurn(userId: string, lang: LangCode, t: TurnRecord): Promise<void> {
    const now = this.now();

    // One transaction: a failed turn never half-writes (turn row without mastery).
    await this.db.transaction(async (tx) => {
      await tx.insert(turns).values({
        id: randomUUID(),
        userId,
        lang,
        componentId: t.componentId,
        promptText: t.promptText,
        referenceText: t.referenceText,
        transcript: t.transcript,
        overallScore: t.overallScore,
        errorDetail: t.errorDetail,
        decision: t.decision,
        ts: t.ts,
      });

      for (const e of t.errorDetail) {
        await tx
          .insert(errorLog)
          .values({ userId, lang, unit: e.unit, expected: e.expected, produced: e.produced, count: 1, lastTs: now })
          .onConflictDoUpdate({
            target: [errorLog.userId, errorLog.lang, errorLog.unit, errorLog.expected, errorLog.produced],
            set: { count: sql`${errorLog.count} + 1`, lastTs: now },
          });
      }

      // Read current mastery within the tx, derive the next state via the tested SRS.
      const rows = await tx
        .select()
        .from(mastery)
        .where(and(eq(mastery.userId, userId), eq(mastery.lang, lang)));
      const masteryMap: Record<string, MasteryRecord> = {};
      const known: string[] = [];
      for (const r of rows) {
        masteryMap[r.componentId] = {
          componentId: r.componentId,
          strength: r.strength,
          lastSeen: r.lastSeen,
          dueAt: r.dueAt,
        };
        if (r.known) known.push(r.componentId);
      }
      const prev: LearnerState = { userId, lang, known, mastery: masteryMap, turnIndex: 0, lastTurns: [] };
      const next = applyTurnOutcome(
        prev,
        { focusComponentId: t.componentId, masteryDelta: t.masteryDelta, outcome: t.decision },
        now,
      );
      const knownSet = new Set(next.known);

      for (const rec of Object.values(next.mastery)) {
        const isKnown = knownSet.has(rec.componentId);
        await tx
          .insert(mastery)
          .values({
            userId,
            lang,
            componentId: rec.componentId,
            strength: rec.strength,
            known: isKnown,
            lastSeen: rec.lastSeen,
            dueAt: rec.dueAt,
          })
          .onConflictDoUpdate({
            target: [mastery.userId, mastery.lang, mastery.componentId],
            set: { strength: rec.strength, known: isKnown, lastSeen: rec.lastSeen, dueAt: rec.dueAt },
          });
      }
    });
  }
}
