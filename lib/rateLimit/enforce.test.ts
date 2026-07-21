import { beforeEach, describe, expect, it } from "vitest";
import { enforceRateLimit, RATE_LIMITS } from "./enforce";
import { _resetRateLimiterForTests } from "./limiter";

function requestFrom(ip: string): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("enforceRateLimit", () => {
  beforeEach(() => {
    _resetRateLimiterForTests();
  });

  it("allows requests under the bucket's limit", () => {
    const bucket = { name: "test-bucket-a", limit: 2, windowMs: 60_000 };
    expect(enforceRateLimit(bucket, requestFrom("1.1.1.1"))).toBeNull();
    expect(enforceRateLimit(bucket, requestFrom("1.1.1.1"))).toBeNull();
  });

  it("returns a 429 Response with Retry-After once the limit is exceeded", async () => {
    const bucket = { name: "test-bucket-b", limit: 1, windowMs: 60_000 };
    expect(enforceRateLimit(bucket, requestFrom("2.2.2.2"))).toBeNull();
    const blocked = enforceRateLimit(bucket, requestFrom("2.2.2.2"));
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();
    const body = (await blocked!.json()) as { error: string; retryAfterSeconds: number };
    expect(body.error).toMatch(/sending requests a bit fast/i);
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks distinct client IPs independently", () => {
    const bucket = { name: "test-bucket-c", limit: 1, windowMs: 60_000 };
    expect(enforceRateLimit(bucket, requestFrom("3.3.3.3"))).toBeNull();
    expect(enforceRateLimit(bucket, requestFrom("4.4.4.4"))).toBeNull();
    expect(enforceRateLimit(bucket, requestFrom("3.3.3.3"))).not.toBeNull();
  });

  it("falls back to the first hop of x-forwarded-for when multiple are present", () => {
    const bucket = { name: "test-bucket-d", limit: 1, windowMs: 60_000 };
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "x-forwarded-for": "5.5.5.5, 9.9.9.9" },
    });
    expect(enforceRateLimit(bucket, request)).toBeNull();
    expect(enforceRateLimit(bucket, requestFrom("5.5.5.5"))).not.toBeNull();
  });

  it("exposes the expected bucket names and cost-tiered limits", () => {
    expect(RATE_LIMITS.scoring.limit).toBeLessThan(RATE_LIMITS.generation.limit);
    expect(RATE_LIMITS.generation.limit).toBeLessThanOrEqual(RATE_LIMITS.chat.limit);
  });
});
