import { checkRateLimit, type RateLimitConfig } from "./limiter";

export interface RateLimitBucket extends RateLimitConfig {
  name: string;
}

/**
 * Three cost-shaped tiers, matching the model-routing tiers in
 * lib/gemini/models.ts: "scoring" gates the expensive Pro-tier double/
 * triple-pass calls, "generation" gates Flash-tier question/plan
 * generation, and "chat" gates the cheap warm-teacher exchanges. Limits
 * are per client IP (see clientIp below) since the app has no real auth
 * yet — see lib/demoUser.ts — so a client-supplied userId can't be
 * trusted as a rate-limit key.
 */
export const RATE_LIMITS = {
  scoring: { name: "scoring", limit: 5, windowMs: 60_000 },
  generation: { name: "generation", limit: 15, windowMs: 60_000 },
  chat: { name: "chat", limit: 20, windowMs: 60_000 },
  media: { name: "media", limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitBucket>;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Checks the request against a rate-limit bucket and returns a ready-to-
 * return 429 Response when it's exceeded, or null when the caller should
 * proceed. Callers place this as the very first thing in a route handler,
 * before any DB/Gemini work:
 *
 *   const limited = enforceRateLimit(RATE_LIMITS.scoring, request);
 *   if (limited) return limited;
 */
export function enforceRateLimit(bucket: RateLimitBucket, request: Request): Response | null {
  const key = `${bucket.name}:${clientIp(request)}`;
  const result = checkRateLimit(key, bucket);
  if (result.allowed) return null;

  return Response.json(
    {
      error: `You're sending requests a bit fast — please wait ${result.retryAfterSeconds}s and try again.`,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
