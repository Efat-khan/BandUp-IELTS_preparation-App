import { describe, expect, it } from "vitest";
import { evaluateRegressionGate, type CalibrationBaseline } from "./regressionGate";

const baseline: CalibrationBaseline = {
  withinHalfBandPct: 88,
  mae: 0.32,
  scoredCount: 20,
  evaluatorVersion: "2026.07-v1",
  recordedAt: "2026-07-01T00:00:00.000Z",
};

describe("evaluateRegressionGate", () => {
  it("always passes a synthetic-only run, regardless of its numbers", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 10, mae: 5, scoredCount: 3 },
      baseline,
      syntheticOnly: true,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(true);
    expect(result.notes[0]).toMatch(/synthetic/i);
  });

  it("fails when nothing was successfully scored", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 0, mae: 0, scoredCount: 0 },
      baseline: null,
      syntheticOnly: false,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(false);
    expect(result.blockingReasons[0]).toMatch(/no essays were successfully scored/i);
  });

  it("fails below the floor target even with no baseline yet", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 70, mae: 0.6, scoredCount: 10 },
      baseline: null,
      syntheticOnly: false,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(false);
    expect(result.blockingReasons[0]).toMatch(/below the 85% target/);
  });

  it("passes above the floor target with no baseline yet, noting one should be established", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 90, mae: 0.25, scoredCount: 10 },
      baseline: null,
      syntheticOnly: false,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.notes[0]).toMatch(/no baseline recorded yet/i);
  });

  it("fails on ANY drop below the baseline, even while still above the floor target", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 86, mae: 0.4, scoredCount: 20 }, // above 85% floor, below 88% baseline
      baseline,
      syntheticOnly: false,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(false);
    expect(result.blockingReasons[0]).toMatch(/dropped from 88.0%/);
    expect(result.blockingReasons[0]).toMatch(/to 86.0%/);
  });

  it("passes when matching the baseline exactly", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 88, mae: 0.3, scoredCount: 22 },
      baseline,
      syntheticOnly: false,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
  });

  it("passes when improving on the baseline", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 92, mae: 0.2, scoredCount: 25 },
      baseline,
      syntheticOnly: false,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(true);
    expect(result.blockingReasons).toHaveLength(0);
    expect(result.notes).toHaveLength(0);
  });

  it("reports both a floor breach and a baseline regression together", () => {
    const result = evaluateRegressionGate({
      current: { withinHalfBandPct: 60, mae: 0.9, scoredCount: 15 },
      baseline,
      syntheticOnly: false,
      minWithinHalfBandPct: 85,
    });
    expect(result.pass).toBe(false);
    expect(result.blockingReasons).toHaveLength(2);
  });
});
