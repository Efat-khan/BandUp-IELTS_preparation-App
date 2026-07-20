import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { prisma } from "@/lib/db";
import { generate, structureFreeText } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import {
  assembleQuestionContract,
  QuestionGenerationLLMSchema,
  type QuestionGenerationContract,
} from "@/lib/gemini/schemas/question";
import {
  buildTask2GeneratorSystemPrompt,
  buildTask2GeneratorUserPrompt,
} from "@/lib/prompts/generator";
import { computeQuestionDedupeHash, isDuplicateQuestion } from "@/lib/questions/dedupe";

export const dynamic = "force-dynamic";

const MAX_GENERATION_ATTEMPTS = 3;
const DEDUPE_WINDOW = 20;

const DIFFICULTY_MAP = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
const TEST_TYPE_MAP = { academic: "ACADEMIC", general: "GENERAL" } as const;

interface GenerateRequestBody {
  userId?: string;
  testType?: "academic" | "general";
  difficulty?: "easy" | "medium" | "hard";
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
  const testType = body.testType ?? "academic";

  const recentQuestions = await prisma.question.findMany({
    where: { requestedByUserId: userId, taskType: "WRITING_TASK2" },
    orderBy: { createdAt: "desc" },
    take: DEDUPE_WINDOW,
    select: { dedupeHash: true, topic: true },
  });
  const recentHashes = recentQuestions
    .map((q) => q.dedupeHash)
    .filter((h): h is string => Boolean(h));
  const avoidTopics = recentQuestions
    .map((q) => q.topic)
    .filter((t): t is string => Boolean(t));

  const systemPrompt = buildTask2GeneratorSystemPrompt();

  let contract: QuestionGenerationContract | null = null;
  let dedupeHash = "";
  let wasDeduped = false;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const userPrompt = buildTask2GeneratorUserPrompt({
      testType,
      difficulty: body.difficulty,
      avoidTopics,
    });

    // Search grounding + structured output can't be combined in one call —
    // generate() gets the grounded free text, structureFreeText() coerces
    // it into the exact contract shape (see lib/gemini/client.ts).
    const rawText = await generate(systemPrompt, userPrompt);
    const llmOutput = await structureFreeText(rawText, QuestionGenerationLLMSchema);
    const candidate = assembleQuestionContract(llmOutput);
    const hash = computeQuestionDedupeHash(candidate.topic_tag, candidate.prompt);

    if (!isDuplicateQuestion(hash, recentHashes)) {
      contract = candidate;
      dedupeHash = hash;
      break;
    }
    wasDeduped = true;
    avoidTopics.push(candidate.topic_tag);
  }

  if (!contract) {
    return Response.json(
      { error: "Could not generate a sufficiently novel question after retries." },
      { status: 503 },
    );
  }

  const question = await prisma.question.create({
    data: {
      module: "WRITING",
      taskType: "WRITING_TASK2",
      testType: TEST_TYPE_MAP[contract.test_type],
      prompt: contract.prompt,
      topic: contract.topic_tag,
      difficulty: DIFFICULTY_MAP[contract.difficulty],
      instructions: contract.instructions,
      expectedWordCount: contract.expected_word_count,
      timeLimitSeconds: contract.time_limit_seconds,
      dedupeHash,
      requestedByUserId: userId,
      source: "GENERATED",
      modelId: GEMINI_MODELS.generation,
    },
  });

  return Response.json({
    id: question.id,
    ...contract,
    deduped_retry: wasDeduped,
  });
}
