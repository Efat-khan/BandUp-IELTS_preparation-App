import { describe, expect, it } from "vitest";
import {
  combineSpeakingDoublePass,
  combineSpeakingWithThirdPass,
  needsThirdPass,
} from "./speakingDoublePass";
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

describe("needsThirdPass", () => {
  it("is true only once a criterion exceeds the third-pass tolerance", () => {
    const pass1 = makeEvaluation({ fc: 5, lr: 6, gra: 6, pr: 6 });
    const atBoundary = makeEvaluation({ fc: 6, lr: 6, gra: 6, pr: 6 }); // delta 1.0
    const overBoundary = makeEvaluation({ fc: 6.5, lr: 6, gra: 6, pr: 6 }); // delta 1.5

    expect(needsThirdPass(combineSpeakingDoublePass(pass1, atBoundary).disagreements)).toBe(false);
    expect(needsThirdPass(combineSpeakingDoublePass(pass1, overBoundary).disagreements)).toBe(true);
  });
});

describe("combineSpeakingWithThirdPass", () => {
  it("uses the median of the three passes, not their average", () => {
    const pass1 = makeEvaluation({ fc: 6, lr: 6, gra: 6, pr: 6 });
    const pass2 = makeEvaluation({ fc: 8, lr: 6, gra: 6, pr: 6 }); // delta 2, triggers
    const pass3 = makeEvaluation({ fc: 6.5, lr: 6, gra: 6, pr: 6 });
    const result = combineSpeakingWithThirdPass(pass1, pass2, pass3);
    // median(6, 8, 6.5) = 6.5 — the average (6.833) would be pulled toward pass2's outlier
    expect(result.canonicalBands.fluency_coherence).toBe(6.5);
    expect(result.thirdPassTriggered).toBe(true);
    expect(result.disagreementFlagged).toBe(true);
  });
});
