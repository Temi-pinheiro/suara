import { eq } from 'drizzle-orm';
import type { LangCode } from '@suara/core';
import type { PendingTurn, PendingTurnStore } from '../turn/pending';
import type { Db } from './client';
import { pendingTurns } from './schema';

/** Production PendingTurnStore — survives across stateless serverless invocations. */
export class DrizzlePendingTurnStore implements PendingTurnStore {
  constructor(private readonly db: Db) {}

  async put(p: PendingTurn): Promise<void> {
    await this.db
      .insert(pendingTurns)
      .values({
        id: p.turnId,
        userId: p.userId,
        lang: p.lang,
        decision: p.decision,
        ctx: p.ctx,
        createdAt: p.createdAt,
      })
      .onConflictDoNothing();
  }

  async take(turnId: string): Promise<PendingTurn | null> {
    // Atomic single-use: delete-returning so two concurrent attempts on one turnId
    // can't both read the row and double-process the recording.
    const rows = await this.db.delete(pendingTurns).where(eq(pendingTurns.id, turnId)).returning();
    const row = rows[0];
    if (!row) return null;
    return {
      turnId: row.id,
      userId: row.userId,
      lang: row.lang as LangCode,
      decision: row.decision,
      ctx: row.ctx,
      createdAt: row.createdAt,
    };
  }
}
