import { prisma } from "@/lib/db";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import type { WritingCriterionKey } from "@/lib/gemini/schemas/writingEvaluation";
import type { ScoredCriterionId } from "./guardrails";
import type { WritingEvaluationOutcome } from "./evaluateWriting";

/**
 * Persists a WritingEvaluationOutcome (submission + double-pass audit trail
 * + canonical score + next-band-action feedback). Shared by the standalone
 * /api/evaluate/writing route and the /api/mock/writing/submit route, which
 * both produce the same outcome shape but attach it to different contexts
 * (a plain submission vs. one half of a timed Task1+Task2 mock).
 */

export interface PersistWritingEvaluationInput {
  userId: string;
  questionId: string;
  answerText: string;
  mockSessionId?: string;
}

export interface PersistedCriterionResult {
  criterion: ScoredCriterionId;
  band: number;
  evidence: string[];
  why: string;
  wordCountPenaltyApplied: boolean;
  calibrationClamped: boolean;
}

export interface PersistedWritingResult {
  submissionId: string;
  status: "FAILED" | "SCORED" | "FLAGGED";
  wordCount: number;
  disagreementFlagged: boolean;
  overallBand?: number;
  overallUnrounded?: number;
  criteria?: PersistedCriterionResult[];
  inlineErrors?: Array<{ quote: string; issue: string; correction: string; category: string }>;
  nextBandActions?: string[];
  modelSelfEstimatedBand?: number;
  shortCircuitReason?: string;
}

const CRITERION_KEY_MAP: Record<ScoredCriterionId, WritingCriterionKey> = {
  TR: "task_response",
  TA: "task_response",
  CC: "coherence_cohesion",
  LR: "lexical_resource",
  GRA: "grammatical_range_accuracy",
};

export async function persistWritingEvaluation(
  outcome: WritingEvaluationOutcome,
  input: PersistWritingEvaluationInput,
): Promise<PersistedWritingResult> {
  if (outcome.shortCircuited) {
    const submission = await prisma.submission.create({
      data: {
        userId: input.userId,
        questionId: input.questionId,
        module: "WRITING",
        status: "FAILED",
        answerText: input.answerText,
        wordCount: outcome.preCheck.wordCount,
        mockSessionId: input.mockSessionId,
      },
    });
    await prisma.feedback.create({
      data: {
        submissionId: submission.id,
        kind: "EXAMINER_COMMENT",
        content: outcome.shortCircuitReason ?? "Submission could not be scored.",
      },
    });
    return {
      submissionId: submission.id,
      status: "FAILED",
      disagreementFlagged: false,
      wordCount: outcome.preCheck.wordCount,
      shortCircuitReason: outcome.shortCircuitReason,
    };
  }

  const {
    criteria,
    pass1,
    pass2,
    disagreementFlagged,
    unroundedTaskBand,
    taskBand,
    modelSelfEstimatedBand,
    preCheck,
    primaryCriterion,
  } = outcome;
  if (!criteria || !pass1 || !pass2 || unroundedTaskBand === undefined || taskBand === undefined) {
    throw new Error("Evaluation outcome is missing required fields for persistence");
  }

  const status = disagreementFlagged ? ("FLAGGED" as const) : ("SCORED" as const);

  const submission = await prisma.submission.create({
    data: {
      userId: input.userId,
      questionId: input.questionId,
      module: "WRITING",
      status,
      answerText: input.answerText,
      wordCount: preCheck.wordCount,
      overallUnrounded: unroundedTaskBand,
      overallBand: taskBand,
      modelSelfEstimatedBand,
      inlineErrors: pass1.inline_errors,
      wordCountPenaltyApplied: criteria[primaryCriterion].wordCountPenaltyApplied,
      disagreementFlagged,
      mockSessionId: input.mockSessionId,
    },
  });

  const criterionIds = Object.keys(criteria) as ScoredCriterionId[];

  const scoreRows = criterionIds.flatMap((criterionId) => {
    const key = CRITERION_KEY_MAP[criterionId];
    const p1 = pass1[key];
    const p2 = pass2[key];
    const canonical = criteria[criterionId];
    return [
      {
        submissionId: submission.id,
        pass: 1,
        criterion: criterionId,
        score: p1.band,
        evidence: { evidence: p1.evidence, why: p1.why },
        modelId: GEMINI_MODELS.scoring,
      },
      {
        submissionId: submission.id,
        pass: 2,
        criterion: criterionId,
        score: p2.band,
        evidence: { evidence: p2.evidence, why: p2.why },
        modelId: GEMINI_MODELS.scoring,
      },
      {
        submissionId: submission.id,
        pass: 0,
        criterion: criterionId,
        score: canonical.finalBand,
        evidence: {
          evidence: p1.evidence,
          why: p1.why,
          rawBand: canonical.rawBand,
          wordCountPenaltyApplied: canonical.wordCountPenaltyApplied,
          calibrationClamped: canonical.calibrationClamped,
        },
        modelId: GEMINI_MODELS.scoring,
      },
    ];
  });
  await prisma.score.createMany({ data: scoreRows });

  await prisma.feedback.createMany({
    data: pass1.next_band_actions.map((action) => ({
      submissionId: submission.id,
      kind: "IMPROVEMENTS" as const,
      content: action,
    })),
  });

  return {
    submissionId: submission.id,
    status,
    wordCount: preCheck.wordCount,
    disagreementFlagged,
    overallBand: taskBand,
    overallUnrounded: unroundedTaskBand,
    criteria: criterionIds.map((criterionId) => {
      const key = CRITERION_KEY_MAP[criterionId];
      const p1 = pass1[key];
      return {
        criterion: criterionId,
        band: criteria[criterionId].finalBand,
        evidence: p1.evidence,
        why: p1.why,
        wordCountPenaltyApplied: criteria[criterionId].wordCountPenaltyApplied,
        calibrationClamped: criteria[criterionId].calibrationClamped,
      };
    }),
    inlineErrors: pass1.inline_errors,
    nextBandActions: pass1.next_band_actions.slice(0, 3),
    modelSelfEstimatedBand,
  };
}
