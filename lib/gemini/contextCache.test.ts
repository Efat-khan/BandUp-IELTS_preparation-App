import { describe, expect, it } from "vitest";
import type { GoogleGenAI } from "@google/genai";
import { CONTEXT_CACHING_ENABLED, getOrCreateCache } from "./contextCache";

describe("context caching default posture", () => {
  it("is disabled unless GEMINI_CONTEXT_CACHING=1 is explicitly set", () => {
    // No env var is set for the test run, so this must be the safe default.
    expect(CONTEXT_CACHING_ENABLED).toBe(false);
  });

  it("returns null without ever touching the Gemini client when disabled", async () => {
    const clientThatWouldThrowIfCalled = {
      caches: {
        create: () => {
          throw new Error("should never be called while caching is disabled");
        },
      },
    } as unknown as GoogleGenAI;

    const result = await getOrCreateCache(
      clientThatWouldThrowIfCalled,
      "a long system prompt with descriptor tables",
      "gemini-2.5-pro",
    );
    expect(result).toBeNull();
  });
});
