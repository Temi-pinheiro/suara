/**
 * Drizzle schema — the data model from PLAN.md §4 (Supabase Postgres).
 *
 * Two small, documented additions beyond the §4 sketch:
 *  - `mastery.lang` and `mastery.known`: a learner can study several languages, and
 *    "known" (introduced & available for recombination) is distinct from `strength`
 *    (the SRS dimension). Both are needed to reconstruct LearnerState faithfully.
 *  - `pending_turns`: holds the in-flight TurnDecision between the two HTTP calls of
 *    one turn (the learner records in between) — server orchestration, not pedagogy.
 *
 * The reading layer (PLAN.md §11) reuses `components.surface` / `expected_tones`
 * without migration.
 */

import {
  bigint,
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { ErrorDetail, TurnContext, TurnDecision } from '@suara/core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  l1: text('l1').notNull().default('eng'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const enrollments = pgTable(
  'enrollments',
  {
    userId: text('user_id').notNull(),
    lang: text('lang').notNull(),
    levelEstimate: text('level_estimate'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.lang] }) }),
);

export const components = pgTable('components', {
  id: text('id').primaryKey(),
  lang: text('lang').notNull(),
  kind: text('kind').notNull(),
  surface: text('surface').notNull(),
  glossEn: text('gloss_en').notNull(),
  expectedTones: text('expected_tones'),
  prereqIds: jsonb('prereq_ids').$type<string[]>().notNull().default([]),
  introAudioRef: text('intro_audio_ref'),
  modelAudioRefs: jsonb('model_audio_refs').$type<string[]>().notNull().default([]),
});

export const mastery = pgTable(
  'mastery',
  {
    userId: text('user_id').notNull(),
    lang: text('lang').notNull(),
    componentId: text('component_id').notNull(),
    strength: doublePrecision('strength').notNull().default(0),
    known: boolean('known').notNull().default(false),
    lastSeen: bigint('last_seen', { mode: 'number' }).notNull(),
    dueAt: bigint('due_at', { mode: 'number' }).notNull(),
  },
  // lang is part of the key: a learner can hold the same component id under
  // different languages without collision.
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.lang, t.componentId] }) }),
);

export const turns = pgTable('turns', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  lang: text('lang').notNull(),
  componentId: text('component_id').notNull(),
  promptText: text('prompt_text').notNull(),
  referenceText: text('reference_text').notNull(),
  transcript: text('transcript').notNull(),
  overallScore: doublePrecision('overall_score'),
  errorDetail: jsonb('error_detail').$type<ErrorDetail[]>().notNull().default([]),
  decision: text('decision').notNull(),
  ts: bigint('ts', { mode: 'number' }).notNull(),
});

export const errorLog = pgTable(
  'error_log',
  {
    userId: text('user_id').notNull(),
    lang: text('lang').notNull(),
    unit: text('unit').notNull(),
    expected: text('expected').notNull(),
    produced: text('produced').notNull(),
    count: integer('count').notNull().default(1),
    lastTs: bigint('last_ts', { mode: 'number' }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.lang, t.unit, t.expected, t.produced] }) }),
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  lang: text('lang').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  turnCount: integer('turn_count').notNull().default(0),
});

export const pendingTurns = pgTable('pending_turns', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  lang: text('lang').notNull(),
  decision: jsonb('decision').$type<TurnDecision>().notNull(),
  ctx: jsonb('ctx').$type<TurnContext>().notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});
