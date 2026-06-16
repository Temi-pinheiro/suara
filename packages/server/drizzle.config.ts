import process from 'node:process';
import { defineConfig } from 'drizzle-kit';

// Load the repo-root .env (run via `pnpm --filter @suara/server exec`, cwd = packages/server).
try {
  process.loadEnvFile('../../.env');
} catch {
  // fall back to ambient env
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
