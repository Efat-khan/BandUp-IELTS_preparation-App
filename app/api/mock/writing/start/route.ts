import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { prisma } from "@/lib/db";
import { generateAndPersistQuestion } from "@/lib/questions/generateQuestion";

export const dynamic = "force-dynamic";

interface StartMockRequestBody {
  userId?: string;
  task1TestType?: "academic" | "general";
}

async function parseBody(request: NextRequest): Promise<StartMockRequestBody> {
  try {
    return (await request.json()) as StartMockRequestBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleStart(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

async function handleStart(request: NextRequest): Promise<Response> {
  const body = await parseBody(request);
  const userId = await resolveUserId(body.userId);
  const testType = body.task1TestType ?? "academic";
  const task1Kind = testType === "academic" ? ("task1_academic" as const) : ("task1_general" as const);

  const [task1Result, task2Result] = await Promise.all([
    generateAndPersistQuestion({ taskType: task1Kind, userId, testType }),
    generateAndPersistQuestion({ taskType: "task2", userId, testType }),
  ]);

  const session = await prisma.writingMockSession.create({
    data: {
      userId,
      task1QuestionId: task1Result.questionId,
      task2QuestionId: task2Result.questionId,
    },
  });

  return Response.json({
    sessionId: session.id,
    timeLimitSeconds: session.timeLimitSeconds,
    startedAt: session.startedAt,
    task1: {
      id: task1Result.questionId,
      ...task1Result.contract,
      deduped_retry: task1Result.wasDeduped,
    },
    task2: {
      id: task2Result.questionId,
      ...task2Result.contract,
      deduped_retry: task2Result.wasDeduped,
    },
  });
}
