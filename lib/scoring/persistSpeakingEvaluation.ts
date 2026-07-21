import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import type { SpeakingCriterionKey } from "@/lib/gemini/schemas/speakingEvaluation";
import { updateProgress } from "@/lib/progress/updateProgress";
import type { SpeakingCriterionId, SpeakingEvaluationOutcome } from "./evaluateSpeaking";
import { EVALUATOR_VERSION } from "./evaluatorVersion";

/**
 * Persists a SpeakingEvaluationOutcome against one canonical submission —
 * the session's Part 2 submission for a full mock, or whichever single
 * submission for a quick drill — writing the same pass 1/2 (raw) + pass 0
 * (canonical) Score rows Writing uses, so both modules share one query
 * path for the progress dashboard and weakness drill.
 */

const CRITERION_KEY_MAP: Record<SpeakingCriterionId, SpeakingCriterionKey> = {
  FC: "fluency_coherence",
  LR: "lexical_resource",
  GRA: "grammatical_range_accuracy",
  PR: "pronunciation",
};

export interface PersistSpeakingEvaluationInput {
  canonicalSubmissionId: string;
  userId: string;
}

export async function persistSpeakingEvaluation(
  outcome: SpeakingEvaluationOutcome,
  input: PersistSpeakingEvaluationInput,
): Promise<void> {
  const submission = await prisma.submission.update({
    where: { id: input.canonicalSubmissionId },
    data: {
      status: outcome.disagreementFlagged ? "FLAGGED" : "SCORED",
      overallUnrounded: outcome.unroundedOverallBand,
      overallBand: outcome.overallBand,
      modelSelfEstimatedBand: outcome.modelSelfEstimatedBand,
    },
  });

  const criterionIds = Object.keys(outcome.criteria) as SpeakingCriterionId[];
  const scoreRows: Prisma.ScoreCreateManyInput[] = criterionIds.flatMap((criterionId) => {
    const key = CRITERION_KEY_MAP[criterionId];
    const p1 = outcome.pass1[key];
    const p2 = outcome.pass2[key];
    const p3 = outcome.pass3?.[key];
    const canonical = outcome.criteria[criterionId];
    return [
      {
        submissionId: input.canonicalSubmissionId,
        pass: 1,
        criterion: criterionId,
        score: p1.band,
        evidence: { evidence: p1.evidence, why: p1.why } as unknown as Prisma.InputJsonValue,
        modelId: GEMINI_MODELS.scoring,
        evaluatorVersion: EVALUATOR_VERSION,
      },
      {
        submissionId: input.canonicalSubmissionId,
        pass: 2,
        criterion: criterionId,
        score: p2.band,
        evidence: { evidence: p2.evidence, why: p2.why } as unknown as Prisma.InputJsonValue,
        modelId: GEMINI_MODELS.scoring,
        evaluatorVersion: EVALUATOR_VERSION,
      },
      ...(p3
        ? [
            {
              submissionId: input.canonicalSubmissionId,
              pass: 3,
              criterion: criterionId,
              score: p3.band,
              evidence: { evidence: p3.evidence, why: p3.why } as unknown as Prisma.InputJsonValue,
              modelId: GEMINI_MODELS.scoring,
              evaluatorVersion: EVALUATOR_VERSION,
            },
          ]
        : []),
      {
        submissionId: input.canonicalSubmissionId,
        pass: 0,
        criterion: criterionId,
        score: canonical.band,
        evidence: {
          evidence: canonical.evidence,
          why: canonical.why,
          thirdPassTriggered: outcome.thirdPassTriggered,
        } as unknown as Prisma.InputJsonValue,
        modelId: GEMINI_MODELS.scoring,
        evaluatorVersion: EVALUATOR_VERSION,
      },
    ];
  });
  await prisma.score.createMany({ data: scoreRows });

  await prisma.feedback.createMany({
    data: outcome.upgradePhrases.map((u) => ({
      submissionId: input.canonicalSubmissionId,
      kind: "IMPROVEMENTS" as const,
      content: `"${u.original}" → "${u.upgraded}" — ${u.reason}`,
    })),
  });

  await updateProgress({ userId: input.userId, module: "SPEAKING", date: submission.createdAt });
}
