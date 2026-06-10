/**
 * In-memory sliding-window rate limiter.
 *
 * Single-process (better-sqlite3) deployment, so an in-memory store is
 * sufficient and avoids extra schema/state. State resets on restart, which is
 * acceptable for abuse-prevention throttling.
 *
 * The limiter records hit timestamps per key and counts how many fall inside
 * the trailing window. `now` is injectable so the behavior is deterministic in
 * tests.
 */

export interface RateLimitRule {
  /** Maximum number of hits allowed within `windowMs`. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Hits remaining in the current window (0 when blocked). */
  remaining: number;
  /** Milliseconds until the next hit would be allowed (0 when allowed). */
  retryAfterMs: number;
}

export class RateLimiter {
  private hits = new Map<string, number[]>();

  /**
   * Record an attempt for `key` and report whether it is within the rule.
   * A blocked attempt is NOT recorded, so the window can drain over time.
   */
  check(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
    const windowStart = now - rule.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((ts) => ts > windowStart);

    if (recent.length >= rule.limit) {
      const oldest = recent[0];
      this.hits.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + rule.windowMs - now),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return {
      allowed: true,
      remaining: rule.limit - recent.length,
      retryAfterMs: 0,
    };
  }

  /** Forget all recorded hits for a key (e.g. after a successful login). */
  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Drop keys whose every hit has aged out, to keep the map from growing. */
  prune(maxWindowMs: number, now: number = Date.now()): void {
    const cutoff = now - maxWindowMs;
    for (const [key, timestamps] of this.hits) {
      if (timestamps.every((ts) => ts <= cutoff)) {
        this.hits.delete(key);
      }
    }
  }
}
