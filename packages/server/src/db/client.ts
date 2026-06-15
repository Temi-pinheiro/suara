import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Db = PostgresJsDatabase;

/**
 * Build a Drizzle DB from a Supabase Postgres connection string. The caller passes
 * the string in from the environment (DATABASE_URL) — never hard-code secrets.
 */
export function createDb(connectionString: string): Db {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client);
}
