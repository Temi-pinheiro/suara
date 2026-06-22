/**
 * Approximate cost estimate from a Usage tally. The vendor rates below are rough and
 * plan-dependent (especially TTS/ASR/pron) — they're a ballpark for "is per-turn cost
 * in the right range", and overridable. Anthropic per-token rates are current.
 */

import type { Usage } from './meter';

export interface ModelRate {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface Pricing {
  llm: Record<string, ModelRate>;
  llmDefault: ModelRate;
  /** USD per 1000 TTS characters */
  ttsPerKChar: number;
  /** USD per ASR call */
  asrPerCall: number;
  /** USD per pronunciation call */
  pronPerCall: number;
  /** cache-read tokens bill at ~this fraction of the input rate */
  cacheReadFraction: number;
}

export const DEFAULT_PRICING: Pricing = {
  llm: {
    'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
    'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
    'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  },
  llmDefault: { inputPerMTok: 5, outputPerMTok: 25 },
  ttsPerKChar: 0.1, // approximate; ElevenLabs varies by plan
  asrPerCall: 0.01, // approximate; ElevenLabs Scribe per short clip
  pronPerCall: 0.006, // approximate; Azure per short clip
  cacheReadFraction: 0.1,
};

export interface CostBreakdown {
  llmUsd: number;
  ttsUsd: number;
  asrUsd: number;
  pronUsd: number;
  totalUsd: number;
}

export function estimateCost(usage: Usage, pricing: Pricing = DEFAULT_PRICING): CostBreakdown {
  let llmUsd = 0;
  for (const [model, u] of Object.entries(usage.llm)) {
    const rate = pricing.llm[model] ?? pricing.llmDefault;
    llmUsd +=
      (u.inputTokens * rate.inputPerMTok +
        u.outputTokens * rate.outputPerMTok +
        u.cacheReadTokens * rate.inputPerMTok * pricing.cacheReadFraction) /
      1_000_000;
  }
  const ttsUsd = (usage.ttsChars / 1000) * pricing.ttsPerKChar;
  const asrUsd = usage.asrCalls * pricing.asrPerCall;
  const pronUsd = usage.pronCalls * pricing.pronPerCall;
  return { llmUsd, ttsUsd, asrUsd, pronUsd, totalUsd: llmUsd + ttsUsd + asrUsd + pronUsd };
}
