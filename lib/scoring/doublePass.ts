import { scoreWithSchema } from "@/lib/gemini/client";
import {
  WRITING_CRITERION_KEYS,
  WritingEvaluationSchema,
  type WritingCriterionKey,
  type WritingEvaluation,
} from "@/lib/gemini/schemas/writingEvaluation";

/**
 * Every submission is scored twice at temperature 0 (spec §10.4). Gemini is
 * not guaranteed to be perfectly deterministic even at temp 0, so two
 * passes that land >DISAGREEMENT_TOLERANCE apart on any criterion flag the
 * submission for review. A wider split — >THIRD_PASS_TOLERANCE — is
 * treated as unreliable rather than just noisy: a third pass runs, and the
 * canonical band becomes the MEDIAN of all three (so one outlier pass
 * can't skew the result the way an average of two would).
 */
export const DISAGREEMENT_TOLERANCE = 0.5;
export const THIRD_PASS_TOLERANCE = 1.0;

export interface CriterionDisagreement {
  criterion: WritingCriterionKey;
  pass1: number;
  pass2: number;
  delta: number;
}

export interface DoublePassResult {
  pass1: WritingEvaluation;
  pass2: WritingEvaluation;
  pass3?: WritingEvaluation;
  /** True when pass1/pass2 diverged by more than THIRD_PASS_TOLERANCE on some criterion and a third pass ran. */
  thirdPassTriggered: boolean;
  /** Two-pass average, or three-pass median once a third pass has run. */
  canonicalBands: Record<WritingCriterionKey, number>;
  disagreementFlagged: boolean;
  disagreements: CriterionDisagreement[];
}

export async function runDoublePassScoring(
  systemPrompt: string,
  userPrompt: string,
): Promise<DoublePassResult> {
  const [pass1, pass2] = await Promise.all([
    scoreWithSchema(systemPrompt, userPrompt, WritingEvaluationSchema),
    scoreWithSchema(systemPrompt, userPrompt, WritingEvaluationSchema),
  ]);

  const twoPass = combineDoublePass(pass1, pass2);
  if (!needsThirdPass(twoPass.disagreements)) return twoPass;

  const pass3 = await scoreWithSchema(systemPrompt, userPrompt, WritingEvaluationSchema);
  return combineWithThirdPass(pass1, pass2, pass3);
}

/** A pass1/pass2 split this wide on any criterion is unreliable, not just noisy — a third pass is required. */
export function needsThirdPass(disagreements: CriterionDisagreement[]): boolean {
  return disagreements.some((d) => d.delta > THIRD_PASS_TOLERANCE);
}

/** Split out for testability without any Gemini calls. */
export function combineDoublePass(
  pass1: WritingEvaluation,
  pass2: WritingEvaluation,
): DoublePassResult {
  const canonicalBands = {} as Record<WritingCriterionKey, number>;
  const disagreements: CriterionDisagreement[] = [];

  for (const key of WRITING_CRITERION_KEYS) {
    const b1 = pass1[key].band;
    const b2 = pass2[key].band;
    const delta = Math.abs(b1 - b2);
    canonicalBands[key] = (b1 + b2) / 2;
    if (delta > DISAGREEMENT_TOLERANCE) {
      disagreements.push({ criterion: key, pass1: b1, pass2: b2, delta });
    }
  }

  return {
    pass1,
    pass2,
    thirdPassTriggered: false,
    canonicalBands,
    disagreementFlagged: disagreements.length > 0,
    disagreements,
  };
}

function medianOfThree(a: number, b: number, c: number): number {
  return a + b + c - Math.max(a, b, c) - Math.min(a, b, c);
}

/**
 * Resolves a triggered third pass. Always flagged — a >THIRD_PASS_TOLERANCE
 * split on pass1/pass2 means this result should read as provisional
 * regardless of how close the tiebreaker pass lands. Split out for
 * testability without any Gemini calls, same as combineDoublePass.
 */
export function combineWithThirdPass(
  pass1: WritingEvaluation,
  pass2: WritingEvaluation,
  pass3: WritingEvaluation,
): DoublePassResult {
  const canonicalBands = {} as Record<WritingCriterionKey, number>;
  const disagreements: CriterionDisagreement[] = [];

  for (const key of WRITING_CRITERION_KEYS) {
    const b1 = pass1[key].band;
    const b2 = pass2[key].band;
    const b3 = pass3[key].band;
    canonicalBands[key] = medianOfThree(b1, b2, b3);
    const delta = Math.abs(b1 - b2);
    if (delta > DISAGREEMENT_TOLERANCE) {
      disagreements.push({ criterion: key, pass1: b1, pass2: b2, delta });
    }
  }

  return {
    pass1,
    pass2,
    pass3,
    thirdPassTriggered: true,
    canonicalBands,
    disagreementFlagged: true,
    disagreements,
  };
}
