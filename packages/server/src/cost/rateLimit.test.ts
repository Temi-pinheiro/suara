import { describe, expect, it } from 'vitest';
import { SlidingWindowRateLimiter, createRateLimiterFromEnv } from './rateLimit';

describe('SlidingWindowRateLimiter', () => {
  it('allows up to the cap, then throttles with a retry-after', () => {
    let t = 1_000_000;
    const lim = new SlidingWindowRateLimiter([{ windowMs: 1000, max: 3 }], () => t);

    expect(lim.check('u').ok).toBe(true);
    expect(lim.check('u').ok).toBe(true);
    expect(lim.check('u').ok).toBe(true);

    const blocked = lim.check('u');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1); // ~1s until the oldest hit ages out
  });

  it('refills as the window slides', () => {
    let t = 0;
    const lim = new SlidingWindowRateLimiter([{ windowMs: 1000, max: 2 }], () => t);
    expect(lim.check('u').ok).toBe(true);
    expect(lim.check('u').ok).toBe(true);
    expect(lim.check('u').ok).toBe(false);

    t = 1001; // both prior hits have aged out
    expect(lim.check('u').ok).toBe(true);
  });

  it('tracks each user independently', () => {
    let t = 0;
    const lim = new SlidingWindowRateLimiter([{ windowMs: 1000, max: 1 }], () => t);
    expect(lim.check('a').ok).toBe(true);
    expect(lim.check('a').ok).toBe(false);
    expect(lim.check('b').ok).toBe(true); // b unaffected by a
  });

  it('enforces the tightest of multiple windows', () => {
    let t = 0;
    const lim = new SlidingWindowRateLimiter(
      [
        { windowMs: 1000, max: 5 },
        { windowMs: 10_000, max: 6 },
      ],
      () => t,
    );
    // Spread 6 hits over the minute-ish window without tripping the per-second cap.
    for (let i = 0; i < 6; i++) {
      t = i * 1500;
      expect(lim.check('u').ok).toBe(true);
    }
    t = 9000;
    expect(lim.check('u').ok).toBe(false); // 7th within the 10s window → blocked
  });

  it('reads limits from env (with defaults)', () => {
    const lim = createRateLimiterFromEnv({ SUARA_MAX_REQ_PER_MIN: '2' }, () => 0);
    expect(lim.check('u').ok).toBe(true);
    expect(lim.check('u').ok).toBe(true);
    expect(lim.check('u').ok).toBe(false); // per-min cap of 2 hit
  });
});
