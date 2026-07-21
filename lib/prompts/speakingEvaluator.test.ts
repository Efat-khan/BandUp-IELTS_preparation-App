import { describe, expect, it } from "vitest";
import { buildSpeakingEvaluatorSystemPrompt } from "./speakingEvaluator";

describe("buildSpeakingEvaluatorSystemPrompt", () => {
  it("injects all four criteria's official band descriptors", () => {
    const prompt = buildSpeakingEvaluatorSystemPrompt(false);
    expect(prompt).toContain("Fluency and Coherence");
    expect(prompt).toContain("Lexical Resource");
    expect(prompt).toContain("Grammatical Range and Accuracy");
    expect(prompt).toContain("Pronunciation");
    expect(prompt).toContain("Band 9");
    expect(prompt).toContain("Band 5");
  });

  it("injects illustrative calibration anchors, explicitly labeled as not ground truth", () => {
    const prompt = buildSpeakingEvaluatorSystemPrompt(false);
    expect(prompt).toContain("Illustrative calibration anchors");
    expect(prompt.toLowerCase()).toContain("not ground truth");
    expect(prompt).toContain("~Band 9");
  });

  it("branches the Pronunciation instruction on audio availability", () => {
    const withAudio = buildSpeakingEvaluatorSystemPrompt(true);
    const withoutAudio = buildSpeakingEvaluatorSystemPrompt(false);
    expect(withAudio.toLowerCase()).toContain("raw audio for at least one part is provided");
    expect(withoutAudio.toLowerCase()).toContain("no raw audio is provided");
  });
});
