import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { generateAndPersistQuestion, type QuestionTaskType } from "@/lib/questions/generateQuestion";

export const dynamic = "force-dynamic";

interface GenerateRequestBody {
  userId?: string;
  taskType?: QuestionTaskType;
  testType?: "academic" | "general";
  difficulty?: "easy" | "medium" | "hard";
  register?: "formal" | "semi_formal" | "informal";
}

async function parseBody(request: NextRequest): Promise<GenerateRequestBody> {
  try {
    return (await request.json()) as GenerateRequestBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleGenerate(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

async function handleGenerate(request: NextRequest): Promise<Response> {
  const body = await parseBody(request);
  const userId = await resolveUserId(body.userId);
  const taskType: QuestionTaskType = body.taskType ?? "task2";

  const { contract, questionId, wasDeduped } = await generateAndPersistQuestion({
    taskType,
    userId,
    testType: body.testType,
    difficulty: body.difficulty,
    register: body.register,
  });

  return Response.json({ id: questionId, ...contract, deduped_retry: wasDeduped });
}
