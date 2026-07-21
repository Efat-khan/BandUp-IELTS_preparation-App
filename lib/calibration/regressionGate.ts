/**
 * Pure CI gate logic for scripts/calibrate.ts — no filesystem, no Gemini.
 * "Block merges that lower gold-set accuracy" means: any drop in the
 * within-±0.5-band percentage versus the last accepted baseline fails the
 * gate, and falling below the absolute floor target fails it even with no
 * baseline yet. A synthetic-only run (no real gold-set essays present)
 * can't make either judgment honestly, so it always passes — the harness
 * running end to end is all that proves in that case.
 */

export interface CalibrationMetrics {
  withinHalfBandPct: number;
  mae: number;
  scoredCount: number;
}

export interface CalibrationBaseline extends CalibrationMetrics {
  evaluatorVersion: string;
  recordedAt: string;
}

export interface RegressionGateInput {
  current: CalibrationMetrics;
  baseline: CalibrationBaseline | null;
  syntheticOnly: boolean;
  minWithinHalfBandPct: number;
}

export interface RegressionGateResult {
  pass: boolean;
  blockingReasons: string[];
  notes: string[];
}

export function evaluateRegressionGate(input: RegressionGateInput): RegressionGateResult {
  const blockingReasons: string[] = [];
  const notes: string[] = [];

  if (input.syntheticOnly) {
    notes.push(
      "All calibration essays are synthetic placeholders — not a real accuracy measurement, so the gate cannot judge regression on it. Add real gold-set essays with official bands to calibration/ to enable real gating.",
    );
    return { pass: true, blockingReasons, notes };
  }

  if (input.current.scoredCount === 0) {
    blockingReasons.push("No essays were successfully scored — cannot verify accuracy.");
    return { pass: false, blockingReasons, notes };
  }

  if (input.current.withinHalfBandPct < input.minWithinHalfBandPct) {
    blockingReasons.push(
      `Within ±0.5 band accuracy ${input.current.withinHalfBandPct.toFixed(1)}% is below the ${input.minWithinHalfBandPct}% target.`,
    );
  }

  if (input.baseline) {
    if (input.current.withinHalfBandPct < input.baseline.withinHalfBandPct) {
      blockingReasons.push(
        `Within ±0.5 band accuracy dropped from ${input.baseline.withinHalfBandPct.toFixed(1)}% ` +
          `(baseline recorded ${input.baseline.recordedAt}, evaluator ${input.baseline.evaluatorVersion}) ` +
          `to ${input.current.withinHalfBandPct.toFixed(1)}%.`,
      );
    }
  } else {
    notes.push(
      "No baseline recorded yet. Run `npm run calibrate -- --update-baseline` against real gold-set essays to establish one.",
    );
  }

  return { pass: blockingReasons.length === 0, blockingReasons, notes };
}
