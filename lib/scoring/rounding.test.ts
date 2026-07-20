import { describe, expect, it } from "vitest";
import { roundToIeltsBand } from "./rounding";
import { combineWritingBand } from "./writingBand";

describe("roundToIeltsBand", () => {
  it("keeps exact whole and half bands unchanged", () => {
    expect(roundToIeltsBand(6)).toBe(6);
    expect(roundToIeltsBand(6.5)).toBe(6.5);
    expect(roundToIeltsBand(0)).toBe(0);
    expect(roundToIeltsBand(9)).toBe(9);
  });

  it("rounds fractions below .25 down to the whole band", () => {
    expect(roundToIeltsBand(6.125)).toBe(6);
    expect(roundToIeltsBand(6.24)).toBe(6);
    expect(roundToIeltsBand(7.1)).toBe(7);
  });

  it("rounds fractions in [.25, .75) to the half band", () => {
    expect(roundToIeltsBand(6.25)).toBe(6.5);
    expect(roundToIeltsBand(6.375)).toBe(6.5);
    expect(roundToIeltsBand(6.5)).toBe(6.5);
    expect(roundToIeltsBand(6.74)).toBe(6.5);
  });

  it("rounds fractions at or above .75 up to the next whole band", () => {
    expect(roundToIeltsBand(6.75)).toBe(7);
    expect(roundToIeltsBand(6.875)).toBe(7);
    expect(roundToIeltsBand(8.75)).toBe(9);
  });

  it("handles the four-criteria averages (multiples of 0.125)", () => {
    // (7 + 7 + 6.5 + 6.5) / 4 = 6.75 → 7
    expect(roundToIeltsBand((7 + 7 + 6.5 + 6.5) / 4)).toBe(7);
    // (6 + 6 + 6 + 6.5) / 4 = 6.125 → 6
    expect(roundToIeltsBand((6 + 6 + 6 + 6.5) / 4)).toBe(6);
    // (6.5 + 6.5 + 6.5 + 6) / 4 = 6.375 → 6.5
    expect(roundToIeltsBand((6.5 + 6.5 + 6.5 + 6) / 4)).toBe(6.5);
  });

  it("is robust to binary floating-point drift on boundaries", () => {
    // 0.25 assembled through arithmetic that can drift below the boundary
    expect(roundToIeltsBand(6 + (0.75 - 0.5))).toBe(6.5);
    expect(roundToIeltsBand(6 + 3 * 0.25)).toBe(7);
  });

  it("rejects out-of-range and non-finite input", () => {
    expect(() => roundToIeltsBand(-0.5)).toThrow();
    expect(() => roundToIeltsBand(9.5)).toThrow();
    expect(() => roundToIeltsBand(Number.NaN)).toThrow();
    expect(() => roundToIeltsBand(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("combineWritingBand", () => {
  it("weights Task 2 double: (task1 + 2*task2) / 3", () => {
    const { unrounded, band } = combineWritingBand(6, 7);
    expect(unrounded).toBeCloseTo(20 / 3, 10); // 6.666…
    expect(band).toBe(6.5);
  });

  it("returns exact bands unchanged when tasks agree", () => {
    expect(combineWritingBand(6.5, 6.5).band).toBe(6.5);
    expect(combineWritingBand(9, 9).band).toBe(9);
  });

  it("pulls the overall toward Task 2", () => {
    // Task 2 stronger: (5 + 2*7) / 3 = 6.333… → 6.5
    expect(combineWritingBand(5, 7).band).toBe(6.5);
    // Task 2 weaker: (7 + 2*5) / 3 = 5.666… → 5.5
    expect(combineWritingBand(7, 5).band).toBe(5.5);
  });

  it("keeps the unrounded value for storage alongside the display band", () => {
    const result = combineWritingBand(6, 6.5);
    expect(result.unrounded).toBeCloseTo(19 / 3, 10); // 6.333…
    expect(result.band).toBe(6.5);
    expect(result.unrounded).not.toBe(result.band);
  });
});
