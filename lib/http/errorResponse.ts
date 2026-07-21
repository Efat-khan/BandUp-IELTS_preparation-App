import { ApiError } from "@google/genai";

/**
 * Turns a caught route error into a Response, giving Gemini's own
 * rate-limit/overload errors the same graceful 429/503 treatment as our
 * own rate limiter (lib/rateLimit/enforce.ts) instead of a bare 500 —
 * lib/gemini/client.ts already retries 429/5xx with backoff, so by the
 * time one of these reaches a route handler, retries are exhausted and
 * the user needs an honest, actionable message rather than "Unexpected
 * error 500".
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError && error.status === 429) {
    return Response.json(
      {
        error:
          "The AI service is at capacity right now — please wait a few seconds and try again.",
        retryAfterSeconds: 10,
      },
      { status: 429, headers: { "Retry-After": "10" } },
    );
  }

  if (error instanceof ApiError && error.status >= 500) {
    return Response.json(
      { error: "The AI service is temporarily unavailable — please try again shortly." },
      { status: 503 },
    );
  }

  return Response.json(
    { error: error instanceof Error ? error.message : "Unexpected error" },
    { status: 500 },
  );
}
