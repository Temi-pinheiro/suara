/**
 * Seed the `components` table with a language's curriculum graph. Idempotent
 * (upsert by id). Run from the repo root:  pnpm db:seed
 */

import process from 'node:process';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadComponents } from '@suara/curriculum';
import { components } from '../src/db/schema';

try {
  process.loadEnvFile('../../.env');
} catch {
  /* ambient env */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const lang = (process.argv[2] ?? 'cmn') as 'cmn';
const sql = postgres(url, { ssl: 'require', prepare: false, max: 1 });
const db = drizzle(sql);

const comps = loadComponents(lang);
for (const c of comps) {
  await db
    .insert(components)
    .values({
      id: c.id,
      lang: c.lang,
      kind: c.kind,
      surface: c.surface,
      glossEn: c.glossEn,
      expectedTones: c.expectedTones ?? null,
      prereqIds: c.prereqIds,
      introAudioRef: c.introAudioRef?.url ?? null,
      modelAudioRefs: (c.modelAudioRefs ?? []).map((r) => r.url ?? '').filter(Boolean),
    })
    .onConflictDoUpdate({
      target: components.id,
      set: {
        lang: c.lang,
        kind: c.kind,
        surface: c.surface,
        glossEn: c.glossEn,
        expectedTones: c.expectedTones ?? null,
        prereqIds: c.prereqIds,
      },
    });
}

const [row] = await sql`select count(*)::int as count from components where lang = ${lang}`;
console.log(`seeded ${comps.length} ${lang} components; rows now in db: ${row?.count}`);
await sql.end({ timeout: 5 });
