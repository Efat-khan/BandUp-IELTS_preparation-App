import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { errorResponse } from "@/lib/http/errorResponse";
import { generateAndPersistQuestion, type QuestionTaskType } from "@/lib/questions/generateQuestion";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";

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
    const limited = enforceRateLimit(RATE_LIMITS.generation, request);
    if (limited) return limited;
    return await handleGenerate(request);
  } catch (error) {
    return errorResponse(error);
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
