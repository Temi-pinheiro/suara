import { createHash } from 'node:crypto';

/**
 * Content-hash cache key for TTS: hash(voiceId, text). Identical teacher lines map
 * to one object, so the cache is shared across all learners (the cost lever behind
 * R2's zero-egress economics). Used by both the mock and real TTS providers so
 * cache keys are consistent.
 */
export function contentHash(text: string, voiceId: string): string {
  return createHash('sha256').update(`${voiceId}::${text}`).digest('hex').slice(0, 16);
}
