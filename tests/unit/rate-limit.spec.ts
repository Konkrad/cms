import { describe, it, expect } from "vitest";
import { RateLimiter } from "~/utils/rate-limit";

const rule = { limit: 3, windowMs: 1000 };

describe("RateLimiter", () => {
  it("allows hits up to the limit, then blocks", () => {
    const rl = new RateLimiter();
    const t = 0;

    expect(rl.check("k", rule, t).allowed).toBe(true);
    expect(rl.check("k", rule, t).allowed).toBe(true);
    const third = rl.check("k", rule, t);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = rl.check("k", rule, t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it("does not count blocked attempts against the window", () => {
    const rl = new RateLimiter();
    // Saturate the window at t=0.
    rl.check("k", rule, 0);
    rl.check("k", rule, 0);
    rl.check("k", rule, 0);
    // Blocked attempts midway should not extend or refill the window.
    expect(rl.check("k", rule, 500).allowed).toBe(false);
    // Once the original three age out, a fresh hit is allowed again.
    expect(rl.check("k", rule, 1001).allowed).toBe(true);
  });

  it("drains as the window slides", () => {
    const rl = new RateLimiter();
    rl.check("k", rule, 0);
    rl.check("k", rule, 200);
    rl.check("k", rule, 400);
    expect(rl.check("k", rule, 500).allowed).toBe(false);
    // The first hit (t=0) falls out of the trailing 1000ms window at t=1001.
    expect(rl.check("k", rule, 1001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter();
    rl.check("a", rule, 0);
    rl.check("a", rule, 0);
    rl.check("a", rule, 0);
    expect(rl.check("a", rule, 0).allowed).toBe(false);
    expect(rl.check("b", rule, 0).allowed).toBe(true);
  });

  it("reset() clears a key's history", () => {
    const rl = new RateLimiter();
    rl.check("k", rule, 0);
    rl.check("k", rule, 0);
    rl.check("k", rule, 0);
    expect(rl.check("k", rule, 0).allowed).toBe(false);
    rl.reset("k");
    expect(rl.check("k", rule, 0).allowed).toBe(true);
  });

  it("prune() drops only fully aged-out keys", () => {
    const rl = new RateLimiter();
    rl.check("old", rule, 0);
    rl.check("fresh", rule, 5000);
    rl.prune(rule.windowMs, 5000);
    // "old" aged out and was pruned -> full budget available again.
    expect(rl.check("old", rule, 5000).remaining).toBe(rule.limit - 1);
    // "fresh" survived pruning -> its earlier hit still counts.
    expect(rl.check("fresh", rule, 5000).remaining).toBe(rule.limit - 2);
  });
});
