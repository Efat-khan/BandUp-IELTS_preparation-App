import { scoreWithSchema } from "@/lib/gemini/client";
import {
  WRITING_CRITERION_KEYS,
  WritingEvaluationSchema,
  type WritingCriterionKey,
  type WritingEvaluation,
} from "@/lib/gemini/schemas/writingEvaluation";

/**
 * Every submission is scored twice at temperature 0. Gemini is not
 * guaranteed to be perfectly deterministic even at temp 0, so two passes
 * that land >0.5 band apart on any criterion flag the submission for
 * review instead of silently trusting either pass alone.
 */
export const DISAGREEMENT_TOLERANCE = 0.5;

export interface CriterionDisagreement {
  criterion: WritingCriterionKey;
  pass1: number;
  pass2: number;
  delta: number;
}

export interface DoublePassResult {
  pass1: WritingEvaluation;
  pass2: WritingEvaluation;
  /** Elementwise average of the two passes' bands, per criterion. */
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

  return combineDoublePass(pass1, pass2);
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
    canonicalBands,
    disagreementFlagged: disagreements.length > 0,
    disagreements,
  };
}
