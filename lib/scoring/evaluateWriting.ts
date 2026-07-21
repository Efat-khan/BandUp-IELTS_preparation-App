import {
  buildWritingEvaluatorUserPrompt,
  buildWritingTask1EvaluatorSystemPrompt,
  buildWritingTask2EvaluatorSystemPrompt,
} from "@/lib/prompts/evaluator";
import type {
  WritingCriterionKey,
  WritingEvaluation,
} from "@/lib/gemini/schemas/writingEvaluation";
import { runDoublePassScoring } from "./doublePass";
import {
  applyCalibrationCeiling,
  applyWordCountPenalty,
  MIN_TASK1_WORD_COUNT,
  MIN_TASK2_WORD_COUNT,
  runWritingPreChecks,
  type ScoredCriterionId,
  type WritingPreCheckResult,
} from "./guardrails";
import { combineTaskBand } from "./taskBand";

/**
 * Core Writing evaluation pipeline for all three task kinds — shared by the
 * /api/evaluate/writing route (which persists the result) and
 * scripts/calibrate.ts (which compares it against known official bands).
 * Contains no DB or HTTP concerns.
 *
 * Task 1 (Academic or General) and Task 2 share the exact same 4-criterion
 * JSON contract (WritingEvaluationSchema) and double-pass/guardrail
 * machinery — only the system prompt (descriptors), the primary criterion
 * id (TR vs TA), and the word-count minimum (250 vs 150) differ. The
 * schema's `task_response` field is reused to hold the Task Achievement
 * score/evidence/why when scoring Task 1 — there is no separate schema.
 */

export type WritingTaskKind = "task1_academic" | "task1_general" | "task2";

export interface WritingEvaluationInput {
  taskKind: WritingTaskKind;
  questionPrompt: string;
  instructions: string;
  essayText: string;
}

export interface CriterionOutcome {
  criterion: ScoredCriterionId;
  /** Canonical (double-pass averaged) band before any code guardrail. */
  rawBand: number;
  /** Band after the word-count cap (primary criterion only) and calibration ceiling clamp. */
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
  /** Present only when pass1/pass2 diverged by more than THIRD_PASS_TOLERANCE on some criterion (spec §10.4). */
  pass3?: WritingEvaluation;
  thirdPassTriggered: boolean;
  criteria?: Record<ScoredCriterionId, CriterionOutcome>;
  disagreementFlagged: boolean;
  /** Authoritative — stored in the DB. */
  unroundedTaskBand?: number;
  /** Officially rounded — the only value ever displayed. */
  taskBand?: number;
  /** The evaluator's own self-estimate, averaged across both passes — audit only. */
  modelSelfEstimatedBand?: number;
  /** TR for Task 2, TA for Task 1 (either variant). */
  primaryCriterion: "TR" | "TA";
}

const CRITERION_KEY_MAP: Record<ScoredCriterionId, WritingCriterionKey> = {
  TR: "task_response",
  TA: "task_response",
  CC: "coherence_cohesion",
  LR: "lexical_resource",
  GRA: "grammatical_range_accuracy",
};

function primaryCriterionFor(taskKind: WritingTaskKind): "TR" | "TA" {
  return taskKind === "task2" ? "TR" : "TA";
}

function minWordCountFor(taskKind: WritingTaskKind): number {
  return taskKind === "task2" ? MIN_TASK2_WORD_COUNT : MIN_TASK1_WORD_COUNT;
}

function systemPromptFor(taskKind: WritingTaskKind): string {
  switch (taskKind) {
    case "task2":
      return buildWritingTask2EvaluatorSystemPrompt();
    case "task1_academic":
      return buildWritingTask1EvaluatorSystemPrompt("academic");
    case "task1_general":
      return buildWritingTask1EvaluatorSystemPrompt("general");
  }
}

export async function evaluateWritingSubmission(
  input: WritingEvaluationInput,
): Promise<WritingEvaluationOutcome> {
  const primaryCriterion = primaryCriterionFor(input.taskKind);
  const preCheck = runWritingPreChecks(
    input.questionPrompt,
    input.essayText,
    minWordCountFor(input.taskKind),
  );

  if (preCheck.isEmpty) {
    return {
      shortCircuited: true,
      shortCircuitReason: "Empty submission — nothing to score.",
      preCheck,
      disagreementFlagged: false,
      thirdPassTriggered: false,
      primaryCriterion,
    };
  }
  if (preCheck.isGibberish) {
    return {
      shortCircuited: true,
      shortCircuitReason:
        "The submission does not appear to be coherent English text and was not sent for scoring.",
      preCheck,
      disagreementFlagged: false,
      thirdPassTriggered: false,
      primaryCriterion,
    };
  }

  const systemPrompt = systemPromptFor(input.taskKind);
  const userPrompt = buildWritingEvaluatorUserPrompt({
    questionPrompt: input.questionPrompt,
    instructions: input.instructions,
    essayText: input.essayText,
    preCheckNotes: preCheck.notes,
  });

  const doublePass = await runDoublePassScoring(systemPrompt, userPrompt);

  const criteria = {} as Record<ScoredCriterionId, CriterionOutcome>;
  const criterionIds: ScoredCriterionId[] = [primaryCriterion, "CC", "LR", "GRA"];

  for (const criterionId of criterionIds) {
    const key = CRITERION_KEY_MAP[criterionId];
    const rawBand = doublePass.canonicalBands[key];
    let finalBand = rawBand;
    let wordCountPenaltyApplied = false;

    if (criterionId === primaryCriterion) {
      const penalty = applyWordCountPenalty(rawBand, preCheck.meetsMinWordCount);
      finalBand = penalty.band;
      wordCountPenaltyApplied = penalty.applied;
    }

    const ceiling = applyCalibrationCeiling(criterionId, finalBand);
    finalBand = ceiling.band;

    criteria[criterionId] = {
      criterion: criterionId,
      rawBand,
      finalBand,
      wordCountPenaltyApplied,
      calibrationClamped: ceiling.clamped,
    };
  }

  const { unrounded, band } = combineTaskBand(
    criteria[primaryCriterion].finalBand,
    criteria.CC.finalBand,
    criteria.LR.finalBand,
    criteria.GRA.finalBand,
  );

  const estimatedBands = [
    doublePass.pass1.estimated_task_band,
    doublePass.pass2.estimated_task_band,
    ...(doublePass.pass3 ? [doublePass.pass3.estimated_task_band] : []),
  ];

  return {
    shortCircuited: false,
    preCheck,
    pass1: doublePass.pass1,
    pass2: doublePass.pass2,
    pass3: doublePass.pass3,
    thirdPassTriggered: doublePass.thirdPassTriggered,
    criteria,
    disagreementFlagged: doublePass.disagreementFlagged,
    unroundedTaskBand: unrounded,
    taskBand: band,
    modelSelfEstimatedBand: estimatedBands.reduce((a, b) => a + b, 0) / estimatedBands.length,
    primaryCriterion,
  };
}
