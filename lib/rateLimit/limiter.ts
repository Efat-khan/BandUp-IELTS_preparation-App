/**
 * In-memory fixed-window rate limiter. The app runs as a single Next.js
 * instance behind Docker Compose (no horizontal scaling, no shared cache
 * tier), so a process-local Map is a legitimate store here — it would need
 * to move to Redis/similar the moment the app runs as more than one
 * instance, but that's not this deployment.
 */

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/** Entries idle for longer than this are stale regardless of which config created them. */
const MAX_BUCKET_AGE_MS = 30 * 60_000;
const CLEANUP_INTERVAL_CALLS = 500;
let callsSinceCleanup = 0;

function cleanup(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > MAX_BUCKET_AGE_MS) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(key: string, config: RateLimitConfig, now = Date.now()): RateLimitResult {
  callsSinceCleanup += 1;
  if (callsSinceCleanup >= CLEANUP_INTERVAL_CALLS) {
    callsSinceCleanup = 0;
    cleanup(now);
  }

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= config.windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count < config.limit) {
    bucket.count += 1;
    return { allowed: true, remaining: config.limit - bucket.count, retryAfterSeconds: 0 };
  }

  const retryAfterMs = config.windowMs - (now - bucket.windowStart);
  return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

/** Test-only: clears all buckets so specs don't leak state into each other. */
export function _resetRateLimiterForTests(): void {
  buckets.clear();
  callsSinceCleanup = 0;
}
