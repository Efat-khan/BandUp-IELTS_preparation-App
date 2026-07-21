import { describe, expect, it } from "vitest";
import { computeRecencyEstimates } from "./criterionEstimates";

function score(module: "WRITING" | "SPEAKING", criterion: string, value: number, daysAgo: number) {
  return {
    module,
    criterion,
    score: value,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  };
}

describe("computeRecencyEstimates", () => {
  it("returns an empty object for no scores", () => {
    expect(computeRecencyEstimates([])).toEqual({});
  });

  it("averages only the most recent N scores per bucket", () => {
    const scores = [
      score("WRITING", "GRA", 5.0, 10), // outside the last-3 window
      score("WRITING", "GRA", 6.0, 3),
      score("WRITING", "GRA", 6.5, 2),
      score("WRITING", "GRA", 7.0, 1),
    ];
    // (6.0 + 6.5 + 7.0) / 3 = 6.5 — the old 5.0 must not drag it down
    expect(computeRecencyEstimates(scores)["WRITING:GRA"]).toBeCloseTo(6.5);
  });

  it("keeps the same criterion separate across modules", () => {
    const scores = [
      score("WRITING", "LR", 5.0, 1),
      score("SPEAKING", "LR", 8.0, 1),
    ];
    const estimates = computeRecencyEstimates(scores);
    expect(estimates["WRITING:LR"]).toBe(5.0);
    expect(estimates["SPEAKING:LR"]).toBe(8.0);
  });

  it("uses whatever is available when fewer than N scores exist", () => {
    expect(computeRecencyEstimates([score("SPEAKING", "PR", 5.5, 1)])["SPEAKING:PR"]).toBe(5.5);
  });
});
