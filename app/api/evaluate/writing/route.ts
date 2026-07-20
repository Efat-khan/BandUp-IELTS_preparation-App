import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { prisma } from "@/lib/db";
import { evaluateWritingSubmission, type WritingTaskKind } from "@/lib/scoring/evaluateWriting";
import { persistWritingEvaluation } from "@/lib/scoring/persistWritingEvaluation";

export const dynamic = "force-dynamic";

interface EvaluateRequestBody {
  questionId?: string;
  text?: string;
  userId?: string;
}

function taskKindForQuestion(taskType: string, testType: string): WritingTaskKind {
  if (taskType === "WRITING_TASK2") return "task2";
  return testType === "ACADEMIC" ? "task1_academic" : "task1_general";
}

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
  const taskKind = taskKindForQuestion(question.taskType, question.testType);

  const outcome = await evaluateWritingSubmission({
    taskKind,
    questionPrompt: question.prompt,
    instructions: question.instructions ?? "",
    essayText: body.text,
  });

  const result = await persistWritingEvaluation(outcome, {
    userId,
    questionId: question.id,
    answerText: body.text,
  });

  return Response.json(result, { status: outcome.shortCircuited ? 422 : 200 });
}
