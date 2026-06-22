/**
 * Per-user rate limiting for the public turn endpoint (verify_jwt is off — our own
 * anonymous x-user-id governs access). The realistic cost risk on a TestFlight build
 * isn't malice, it's a stuck client retrying `plan`/`attempt` in a loop and quietly
 * burning Anthropic/ElevenLabs/Azure spend. A sliding window per user bounds that
 * without a table or an extra DB round-trip.
 *
 * A normal turn is two POSTs (plan + attempt), so limits are expressed in *requests*;
 * the env defaults below leave a human learner plenty of headroom while capping loops.
 */

export interface RateWindow {
  windowMs: number;
  max: number;
}

export interface RateDecision {
  ok: boolean;
  /** seconds until the caller may retry (set when ok === false) */
  retryAfterSec?: number;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly longestMs: number;

  constructor(
    private readonly windows: RateWindow[],
    private readonly now: () => number = Date.now,
  ) {
    this.longestMs = Math.max(...windows.map((w) => w.windowMs));
  }

  /** Record + evaluate one request for `key`. Prunes that key's history lazily. */
  check(key: string): RateDecision {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((ts) => t - ts < this.longestMs);

    for (const w of this.windows) {
      const inWindow = recent.filter((ts) => t - ts < w.windowMs);
      if (inWindow.length >= w.max) {
        this.hits.set(key, recent); // keep the pruned history; don't count the rejected hit
        const oldest = Math.min(...inWindow);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((w.windowMs - (t - oldest)) / 1000)) };
      }
    }

    recent.push(t);
    this.hits.set(key, recent);
    return { ok: true };
  }
}

/**
 * Build a limiter from env (or sensible defaults). Tunable without a redeploy of code:
 *   SUARA_MAX_REQ_PER_MIN   (default 12  → ~6 turns/min)
 *   SUARA_MAX_REQ_PER_HOUR  (default 120 → ~60 turns/hour)
 */
export function createRateLimiterFromEnv(
  env: Record<string, string | undefined>,
  now: () => number = Date.now,
): SlidingWindowRateLimiter {
  const perMin = Number(env.SUARA_MAX_REQ_PER_MIN ?? 12);
  const perHour = Number(env.SUARA_MAX_REQ_PER_HOUR ?? 120);
  return new SlidingWindowRateLimiter(
    [
      { windowMs: 60_000, max: perMin },
      { windowMs: 3_600_000, max: perHour },
    ],
    now,
  );
}
