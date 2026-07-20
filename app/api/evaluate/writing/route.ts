import type { NextRequest } from "next/server";
import type { WritingCriterionId } from "@/lib/descriptors/writingTask2";
import { resolveUserId } from "@/lib/demoUser";
import { prisma } from "@/lib/db";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import type { WritingEvaluation } from "@/lib/gemini/schemas/writingEvaluation";
import { evaluateWritingTask2 } from "@/lib/scoring/evaluateWriting";

export const dynamic = "force-dynamic";

interface EvaluateRequestBody {
  questionId?: string;
  text?: string;
  userId?: string;
}

const CRITERION_IDS: WritingCriterionId[] = ["TR", "CC", "LR", "GRA"];

const CRITERION_KEY_MAP: Record<WritingCriterionId, keyof WritingEvaluation> = {
  TR: "task_response",
  CC: "coherence_cohesion",
  LR: "lexical_resource",
  GRA: "grammatical_range_accuracy",
};

export async function POST(request: NextRequest) {
  try {
    return await handleEvaluate(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

async function handleEvaluate(request: NextRequest): Promise<Response> {
  let body: EvaluateRequestBody;
  try {
    body = (await request.json()) as EvaluateRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.questionId || typeof body.text !== "string") {
    return Response.json({ error: "questionId and text are required" }, { status: 400 });
  }

  const question = await prisma.question.findUnique({ where: { id: body.questionId } });
  if (!question) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }

  const userId = await resolveUserId(body.userId);

  const outcome = await evaluateWritingTask2({
    questionPrompt: question.prompt,
    instructions: question.instructions ?? "",
    essayText: body.text,
  });

  if (outcome.shortCircuited) {
    const submission = await prisma.submission.create({
      data: {
        userId,
        questionId: question.id,
        module: "WRITING",
        status: "FAILED",
        answerText: body.text,
        wordCount: outcome.preCheck.wordCount,
      },
    });
    await prisma.feedback.create({
      data: {
        submissionId: submission.id,
        kind: "EXAMINER_COMMENT",
        content: outcome.shortCircuitReason ?? "Submission could not be scored.",
      },
    });
    return Response.json(
      { submissionId: submission.id, error: outcome.shortCircuitReason },
      { status: 422 },
    );
  }

  const {
    criteria,
    pass1,
    disagreementFlagged,
    unroundedTaskBand,
    taskBand,
    modelSelfEstimatedBand,
    preCheck,
  } = outcome;
  if (!criteria || !pass1 || !outcome.pass2) {
    return Response.json({ error: "Evaluation failed unexpectedly" }, { status: 500 });
  }

  const submission = await prisma.submission.create({
    data: {
      userId,
      questionId: question.id,
      module: "WRITING",
      status: disagreementFlagged ? "FLAGGED" : "SCORED",
      answerText: body.text,
      wordCount: preCheck.wordCount,
      overallUnrounded: unroundedTaskBand,
      overallBand: taskBand,
      modelSelfEstimatedBand,
      inlineErrors: pass1.inline_errors,
      wordCountPenaltyApplied: criteria.TR.wordCountPenaltyApplied,
      disagreementFlagged,
    },
  });

  const scoreRows = CRITERION_IDS.flatMap((criterionId) => {
    const key = CRITERION_KEY_MAP[criterionId];
    const p1 = pass1[key] as WritingEvaluation["task_response"];
    const p2 = outcome.pass2![key] as WritingEvaluation["task_response"];
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

  return Response.json({
    submissionId: submission.id,
    status: submission.status,
    overallBand: taskBand,
    overallUnrounded: unroundedTaskBand,
    disagreementFlagged,
    wordCount: preCheck.wordCount,
    criteria: CRITERION_IDS.map((criterionId) => {
      const key = CRITERION_KEY_MAP[criterionId];
      const p1 = pass1[key] as WritingEvaluation["task_response"];
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
  });
}
