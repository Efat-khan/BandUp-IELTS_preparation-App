import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/http/errorResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import { evaluateWritingSubmission, type WritingTaskKind } from "@/lib/scoring/evaluateWriting";
import { persistWritingEvaluation } from "@/lib/scoring/persistWritingEvaluation";
import { combineWritingBand } from "@/lib/scoring/writingBand";
import { runPostSessionPipelineSafe } from "@/lib/teacher/postSession";

export const dynamic = "force-dynamic";

interface SubmitMockRequestBody {
  sessionId?: string;
  task1Text?: string;
  task2Text?: string;
}

function taskKindForQuestion(taskType: string, testType: string): WritingTaskKind {
  if (taskType === "WRITING_TASK2") return "task2";
  return testType === "ACADEMIC" ? "task1_academic" : "task1_general";
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(RATE_LIMITS.scoring, request);
    if (limited) return limited;
    return await handleSubmit(request);
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleSubmit(request: NextRequest): Promise<Response> {
  let body: SubmitMockRequestBody;
  try {
    body = (await request.json()) as SubmitMockRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.sessionId ||
    typeof body.task1Text !== "string" ||
    typeof body.task2Text !== "string"
  ) {
    return Response.json(
      { error: "sessionId, task1Text, and task2Text are required" },
      { status: 400 },
    );
  }

  const session = await prisma.writingMockSession.findUnique({
    where: { id: body.sessionId },
    include: { task1Question: true, task2Question: true },
  });
  if (!session) {
    return Response.json({ error: "Mock session not found" }, { status: 404 });
  }

  const [task1Outcome, task2Outcome] = await Promise.all([
    evaluateWritingSubmission({
      taskKind: taskKindForQuestion(session.task1Question.taskType, session.task1Question.testType),
      questionPrompt: session.task1Question.prompt,
      instructions: session.task1Question.instructions ?? "",
      essayText: body.task1Text,
    }),
    evaluateWritingSubmission({
      taskKind: "task2",
      questionPrompt: session.task2Question.prompt,
      instructions: session.task2Question.instructions ?? "",
      essayText: body.task2Text,
    }),
  ]);

  const [task1Result, task2Result] = await Promise.all([
    persistWritingEvaluation(task1Outcome, {
      userId: session.userId,
      questionId: session.task1QuestionId,
      answerText: body.task1Text,
      mockSessionId: session.id,
    }),
    persistWritingEvaluation(task2Outcome, {
      userId: session.userId,
      questionId: session.task2QuestionId,
      answerText: body.task2Text,
      mockSessionId: session.id,
    }),
  ]);

  for (const result of [task1Result, task2Result]) {
    if (result.status !== "FAILED") {
      await runPostSessionPipelineSafe(result.submissionId);
    }
  }

  let overallUnrounded: number | undefined;
  let overallBand: number | undefined;
  if (task1Result.overallBand !== undefined && task2Result.overallBand !== undefined) {
    const combined = combineWritingBand(task1Result.overallBand, task2Result.overallBand);
    overallUnrounded = combined.unrounded;
    overallBand = combined.band;
  }

  await prisma.writingMockSession.update({
    where: { id: session.id },
    data: {
      status: overallBand !== undefined ? "SCORED" : "SUBMITTED",
      overallUnrounded,
      overallBand,
    },
  });

  return Response.json({
    sessionId: session.id,
    overallUnrounded,
    overallBand,
    task1: task1Result,
    task2: task2Result,
  });
}
