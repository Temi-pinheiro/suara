/**
 * Production wiring: constructs the real Anthropic brain + Drizzle stores from the
 * environment and assembles the turn handlers. Imports the vendor SDKs, so it is
 * kept out of the test path (the handler tests use compose.ts + mocks).
 *
 * Secrets come only from `env` — never hard-coded.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider, type AnthropicClientLike } from '@suara/providers';
import type { LanguageConfig } from '@suara/core';
import { assembleTurnDeps } from './compose';
import { createDb } from './db/client';
import { DrizzleLearnerStore } from './db/learnerStore';
import { DrizzlePendingTurnStore } from './db/pendingStore';
import type { TurnHandlerDeps } from './turn/handlers';

export interface ServerEnv {
  ANTHROPIC_API_KEY?: string;
  DATABASE_URL?: string;
}

export function createTurnHandlerDeps(
  config: LanguageConfig,
  env: ServerEnv,
  curriculumContext?: string,
): TurnHandlerDeps {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const db = createDb(env.DATABASE_URL);
  // `new Anthropic()` reads ANTHROPIC_API_KEY from the environment — no secret here.
  const client = new Anthropic() as unknown as AnthropicClientLike;
  const llm = new AnthropicProvider(
    curriculumContext === undefined ? { config, client } : { config, client, curriculumContext },
  );

  const deps = assembleTurnDeps({ config, store: new DrizzleLearnerStore(db), llm });
  return { deps, pending: new DrizzlePendingTurnStore(db) };
}
