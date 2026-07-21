import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimiterForTests, checkRateLimit } from "./limiter";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateLimiterForTests();
  });

  it("allows requests up to the configured limit within the window", () => {
    const config = { limit: 3, windowMs: 60_000 };
    const now = 1_000_000;
    expect(checkRateLimit("k", config, now).allowed).toBe(true);
    expect(checkRateLimit("k", config, now + 10).allowed).toBe(true);
    expect(checkRateLimit("k", config, now + 20).allowed).toBe(true);
  });

  it("blocks the request that exceeds the limit within the window", () => {
    const config = { limit: 2, windowMs: 60_000 };
    const now = 1_000_000;
    expect(checkRateLimit("k", config, now).allowed).toBe(true);
    expect(checkRateLimit("k", config, now + 10).allowed).toBe(true);
    const third = checkRateLimit("k", config, now + 20);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports a retryAfterSeconds bounded by the remaining window time", () => {
    const config = { limit: 1, windowMs: 60_000 };
    const now = 1_000_000;
    checkRateLimit("k", config, now);
    const blocked = checkRateLimit("k", config, now + 45_000);
    // 60s window, 45s elapsed -> ~15s left
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(15);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the count once the window has elapsed", () => {
    const config = { limit: 1, windowMs: 60_000 };
    const now = 1_000_000;
    expect(checkRateLimit("k", config, now).allowed).toBe(true);
    expect(checkRateLimit("k", config, now + 30_000).allowed).toBe(false);
    expect(checkRateLimit("k", config, now + 60_001).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const config = { limit: 1, windowMs: 60_000 };
    const now = 1_000_000;
    expect(checkRateLimit("a", config, now).allowed).toBe(true);
    expect(checkRateLimit("b", config, now).allowed).toBe(true);
    expect(checkRateLimit("a", config, now + 1).allowed).toBe(false);
    expect(checkRateLimit("b", config, now + 1).allowed).toBe(false);
  });
});
