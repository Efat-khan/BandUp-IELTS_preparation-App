import { describe, expect, it } from "vitest";
import { combineSpeakingDoublePass } from "./speakingDoublePass";
import type { SpeakingEvaluation } from "@/lib/gemini/schemas/speakingEvaluation";

function makeEvaluation(bands: { fc: number; lr: number; gra: number; pr: number }): SpeakingEvaluation {
  const criterion = (band: number) => ({
    band,
    evidence: ["some quoted transcript fragment"],
    why: "rationale referencing the descriptor language for this band",
  });
  return {
    fluency_coherence: criterion(bands.fc),
    lexical_resource: criterion(bands.lr),
    grammatical_range_accuracy: criterion(bands.gra),
    pronunciation: criterion(bands.pr),
    upgrade_phrases: [
      { original: "a lot", upgraded: "a substantial amount", reason: "more precise" },
      { original: "good", upgraded: "beneficial", reason: "less generic" },
      { original: "thing", upgraded: "factor", reason: "more academic" },
    ],
    estimated_overall_band: (bands.fc + bands.lr + bands.gra + bands.pr) / 4,
  };
}

describe("combineSpeakingDoublePass", () => {
  it("averages agreeing passes and does not flag disagreement", () => {
    const pass1 = makeEvaluation({ fc: 6.5, lr: 6.5, gra: 6, pr: 6 });
    const pass2 = makeEvaluation({ fc: 6.5, lr: 7, gra: 6, pr: 6.5 });
    const result = combineSpeakingDoublePass(pass1, pass2);

    expect(result.canonicalBands.fluency_coherence).toBe(6.5);
    expect(result.canonicalBands.lexical_resource).toBeCloseTo(6.75, 10);
    expect(result.canonicalBands.pronunciation).toBeCloseTo(6.25, 10);
    expect(result.disagreementFlagged).toBe(false);
  });

  it("flags a criterion when the two passes diverge beyond tolerance", () => {
    const pass1 = makeEvaluation({ fc: 5, lr: 6, gra: 6, pr: 6 });
    const pass2 = makeEvaluation({ fc: 7, lr: 6, gra: 6, pr: 6 });
    const result = combineSpeakingDoublePass(pass1, pass2);

    expect(result.disagreementFlagged).toBe(true);
    expect(result.disagreements).toHaveLength(1);
    expect(result.disagreements[0]).toMatchObject({
      criterion: "fluency_coherence",
      pass1: 5,
      pass2: 7,
      delta: 2,
    });
  });
});
