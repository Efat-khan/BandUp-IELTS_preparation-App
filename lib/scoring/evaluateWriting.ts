import type { WritingCriterionId } from "@/lib/descriptors/writingTask2";
import {
  buildWritingTask2EvaluatorSystemPrompt,
  buildWritingTask2EvaluatorUserPrompt,
} from "@/lib/prompts/evaluator";
import type {
  WritingCriterionKey,
  WritingEvaluation,
} from "@/lib/gemini/schemas/writingEvaluation";
import { runDoublePassScoring } from "./doublePass";
import {
  applyCalibrationCeiling,
  applyWordCountPenalty,
  runWritingPreChecks,
  type WritingPreCheckResult,
} from "./guardrails";
import { combineTaskBand } from "./taskBand";

/**
 * Core Writing Task 2 evaluation pipeline — shared by the /api/evaluate/writing
 * route (which persists the result) and scripts/calibrate.ts (which compares
 * it against known official bands). Contains no DB or HTTP concerns.
 */

export interface WritingEvaluationInput {
  questionPrompt: string;
  instructions: string;
  essayText: string;
}

export interface CriterionOutcome {
  criterion: WritingCriterionId;
  /** Canonical (double-pass averaged) band before any code guardrail. */
  rawBand: number;
  /** Band after the word-count cap (TR only) and calibration ceiling clamp. */
  finalBand: number;
  wordCountPenaltyApplied: boolean;
  calibrationClamped: boolean;
}

export interface WritingEvaluationOutcome {
  shortCircuited: boolean;
  shortCircuitReason?: string;
  preCheck: WritingPreCheckResult;
  pass1?: WritingEvaluation;
  pass2?: WritingEvaluation;
  criteria?: Record<WritingCriterionId, CriterionOutcome>;
  disagreementFlagged: boolean;
  /** Authoritative — stored in the DB. */
  unroundedTaskBand?: number;
  /** Officially rounded — the only value ever displayed. */
  taskBand?: number;
  /** The evaluator's own self-estimate, averaged across both passes — audit only. */
  modelSelfEstimatedBand?: number;
}

const CRITERION_KEY_MAP: Record<WritingCriterionId, WritingCriterionKey> = {
  TR: "task_response",
  CC: "coherence_cohesion",
  LR: "lexical_resource",
  GRA: "grammatical_range_accuracy",
};

export async function evaluateWritingTask2(
  input: WritingEvaluationInput,
): Promise<WritingEvaluationOutcome> {
  const preCheck = runWritingPreChecks(input.questionPrompt, input.essayText);

  if (preCheck.isEmpty) {
    return {
      shortCircuited: true,
      shortCircuitReason: "Empty submission — nothing to score.",
      preCheck,
      disagreementFlagged: false,
    };
  }
  if (preCheck.isGibberish) {
    return {
      shortCircuited: true,
      shortCircuitReason:
        "The submission does not appear to be coherent English text and was not sent for scoring.",
      preCheck,
      disagreementFlagged: false,
    };
  }

  const systemPrompt = buildWritingTask2EvaluatorSystemPrompt();
  const userPrompt = buildWritingTask2EvaluatorUserPrompt({
    questionPrompt: input.questionPrompt,
    instructions: input.instructions,
    essayText: input.essayText,
    preCheckNotes: preCheck.notes,
  });

  const doublePass = await runDoublePassScoring(systemPrompt, userPrompt);

  const criteria = {} as Record<WritingCriterionId, CriterionOutcome>;
  for (const [criterion, key] of Object.entries(CRITERION_KEY_MAP) as Array<
    [WritingCriterionId, WritingCriterionKey]
  >) {
    const rawBand = doublePass.canonicalBands[key];
    let finalBand = rawBand;
    let wordCountPenaltyApplied = false;

    if (criterion === "TR") {
      const penalty = applyWordCountPenalty(rawBand, preCheck.meetsMinWordCount);
      finalBand = penalty.band;
      wordCountPenaltyApplied = penalty.applied;
    }

    const ceiling = applyCalibrationCeiling(criterion, finalBand);
    finalBand = ceiling.band;

    criteria[criterion] = {
      criterion,
      rawBand,
      finalBand,
      wordCountPenaltyApplied,
      calibrationClamped: ceiling.clamped,
    };
  }

  const { unrounded, band } = combineTaskBand(
    criteria.TR.finalBand,
    criteria.CC.finalBand,
    criteria.LR.finalBand,
    criteria.GRA.finalBand,
  );

  return {
    shortCircuited: false,
    preCheck,
    pass1: doublePass.pass1,
    pass2: doublePass.pass2,
    criteria,
    disagreementFlagged: doublePass.disagreementFlagged,
    unroundedTaskBand: unrounded,
    taskBand: band,
    modelSelfEstimatedBand:
      (doublePass.pass1.estimated_task_band + doublePass.pass2.estimated_task_band) / 2,
  };
}
