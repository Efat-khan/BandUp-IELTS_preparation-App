import { ApiError } from "@google/genai";
import { describe, expect, it } from "vitest";
import { errorResponse } from "./errorResponse";

async function readJson(response: Response): Promise<{ error: string; retryAfterSeconds?: number }> {
  return (await response.json()) as { error: string; retryAfterSeconds?: number };
}

describe("errorResponse", () => {
  it("maps a Gemini 429 to a graceful 429 with Retry-After and a friendly message", async () => {
    const response = errorResponse(new ApiError({ message: "RESOURCE_EXHAUSTED", status: 429 }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    const body = await readJson(response);
    expect(body.error).toMatch(/AI service is at capacity/i);
    expect(body.retryAfterSeconds).toBe(10);
  });

  it("maps a Gemini 5xx to a 503 without exposing the raw upstream message", async () => {
    const response = errorResponse(new ApiError({ message: "internal error", status: 503 }));
    expect(response.status).toBe(503);
    const body = await readJson(response);
    expect(body.error).toMatch(/temporarily unavailable/i);
  });

  it("falls back to a 500 with the error's own message for non-Gemini errors", async () => {
    const response = errorResponse(new Error("Question not found"));
    expect(response.status).toBe(500);
    const body = await readJson(response);
    expect(body.error).toBe("Question not found");
  });

  it("falls back to a generic 500 message for non-Error throws", async () => {
    const response = errorResponse("some string throw");
    expect(response.status).toBe(500);
    const body = await readJson(response);
    expect(body.error).toBe("Unexpected error");
  });
});
