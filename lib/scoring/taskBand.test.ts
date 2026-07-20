import { describe, expect, it } from "vitest";
import { combineTaskBand } from "./taskBand";

describe("combineTaskBand", () => {
  it("weights all four criteria equally", () => {
    const { unrounded, band } = combineTaskBand(6, 6, 6, 6);
    expect(unrounded).toBe(6);
    expect(band).toBe(6);
  });

  it("rounds a mixed set of criteria per the official rule", () => {
    // (7 + 7 + 6.5 + 6.5) / 4 = 6.75 -> 7
    const { unrounded, band } = combineTaskBand(7, 7, 6.5, 6.5);
    expect(unrounded).toBeCloseTo(6.75, 10);
    expect(band).toBe(7);
  });

  it("keeps the unrounded value distinct from the display band", () => {
    // (6 + 6 + 6 + 6.5) / 4 = 6.125 -> 6
    const result = combineTaskBand(6, 6, 6, 6.5);
    expect(result.unrounded).toBeCloseTo(6.125, 10);
    expect(result.band).toBe(6);
    expect(result.unrounded).not.toBe(result.band);
  });
});
