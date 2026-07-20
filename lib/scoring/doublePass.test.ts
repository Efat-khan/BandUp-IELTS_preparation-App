import { describe, expect, it } from "vitest";
import { combineDoublePass } from "./doublePass";
import type { WritingEvaluation } from "@/lib/gemini/schemas/writingEvaluation";

function makeEvaluation(bands: {
  tr: number;
  cc: number;
  lr: number;
  gra: number;
}): WritingEvaluation {
  const criterion = (band: number) => ({
    band,
    evidence: ["some quoted fragment from the essay"],
    why: "rationale referencing the descriptor language for this band",
  });
  return {
    task_response: criterion(bands.tr),
    coherence_cohesion: criterion(bands.cc),
    lexical_resource: criterion(bands.lr),
    grammatical_range_accuracy: criterion(bands.gra),
    inline_errors: [],
    next_band_actions: ["action one", "action two", "action three"],
    estimated_task_band: (bands.tr + bands.cc + bands.lr + bands.gra) / 4,
  };
}

describe("combineDoublePass", () => {
  it("averages agreeing passes and does not flag disagreement", () => {
    const pass1 = makeEvaluation({ tr: 6.5, cc: 6.5, lr: 6, gra: 6 });
    const pass2 = makeEvaluation({ tr: 6.5, cc: 7, lr: 6, gra: 6.5 });
    const result = combineDoublePass(pass1, pass2);

    expect(result.canonicalBands.task_response).toBe(6.5);
    expect(result.canonicalBands.coherence_cohesion).toBeCloseTo(6.75, 10);
    expect(result.canonicalBands.grammatical_range_accuracy).toBeCloseTo(6.25, 10);
    expect(result.disagreementFlagged).toBe(false);
    expect(result.disagreements).toHaveLength(0);
  });

  it("flags a criterion when the two passes diverge beyond tolerance", () => {
    const pass1 = makeEvaluation({ tr: 5, cc: 6, lr: 6, gra: 6 });
    const pass2 = makeEvaluation({ tr: 7, cc: 6, lr: 6, gra: 6 });
    const result = combineDoublePass(pass1, pass2);

    expect(result.disagreementFlagged).toBe(true);
    expect(result.disagreements).toHaveLength(1);
    expect(result.disagreements[0]).toMatchObject({
      criterion: "task_response",
      pass1: 5,
      pass2: 7,
      delta: 2,
    });
    // still produces a best-estimate canonical value even though flagged
    expect(result.canonicalBands.task_response).toBe(6);
  });

  it("does not flag a delta exactly at the tolerance boundary", () => {
    const pass1 = makeEvaluation({ tr: 6, cc: 6, lr: 6, gra: 6 });
    const pass2 = makeEvaluation({ tr: 6.5, cc: 6, lr: 6, gra: 6 });
    const result = combineDoublePass(pass1, pass2);
    expect(result.disagreementFlagged).toBe(false);
  });
});
