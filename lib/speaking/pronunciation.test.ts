import { describe, expect, it } from "vitest";
import { isPronunciationApiConfigured, resolvePronunciationBand } from "./pronunciation";

describe("isPronunciationApiConfigured", () => {
  it("is false when AZURE_SPEECH_KEY is not set", () => {
    const original = process.env.AZURE_SPEECH_KEY;
    delete process.env.AZURE_SPEECH_KEY;
    expect(isPronunciationApiConfigured()).toBe(false);
    if (original) process.env.AZURE_SPEECH_KEY = original;
  });
});

describe("resolvePronunciationBand", () => {
  it("falls back to the LLM's estimated band when no pronunciation API is configured", async () => {
    const original = process.env.AZURE_SPEECH_KEY;
    delete process.env.AZURE_SPEECH_KEY;

    const result = await resolvePronunciationBand({
      llmPronunciationBand: 6.5,
      referenceText: "some transcript text",
    });

    expect(result).toEqual({ source: "ESTIMATED", band: 6.5 });
    if (original) process.env.AZURE_SPEECH_KEY = original;
  });

  it("falls back to the estimate even when configured but no audio is provided", async () => {
    const original = process.env.AZURE_SPEECH_KEY;
    process.env.AZURE_SPEECH_KEY = "test-key";

    const result = await resolvePronunciationBand({
      llmPronunciationBand: 7,
      referenceText: "some transcript text",
    });

    expect(result).toEqual({ source: "ESTIMATED", band: 7 });
    if (original) process.env.AZURE_SPEECH_KEY = original;
    else delete process.env.AZURE_SPEECH_KEY;
  });

  it("falls back to the estimate when the Azure call fails even though configured with audio", async () => {
    const original = process.env.AZURE_SPEECH_KEY;
    process.env.AZURE_SPEECH_KEY = "test-key";

    const result = await resolvePronunciationBand({
      llmPronunciationBand: 5.5,
      audio: { data: Buffer.from("fake-audio"), mimeType: "audio/webm" },
      referenceText: "some transcript text",
    });

    // The stub AzurePronunciationAssessmentProvider always throws (not implemented),
    // so this must fall through to the estimated band rather than propagate the error.
    expect(result).toEqual({ source: "ESTIMATED", band: 5.5 });
    if (original) process.env.AZURE_SPEECH_KEY = original;
    else delete process.env.AZURE_SPEECH_KEY;
  });
});
