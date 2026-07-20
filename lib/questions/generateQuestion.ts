import { prisma } from "@/lib/db";
import { generate, structureFreeText } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import {
  assembleQuestionContract,
  QuestionGenerationLLMSchema,
  type QuestionGenerationContract,
} from "@/lib/gemini/schemas/question";
import {
  assembleTask1AcademicContract,
  Task1AcademicGenerationLLMSchema,
  type Task1AcademicGenerationContract,
} from "@/lib/gemini/schemas/task1Academic";
import {
  assembleTask1GeneralContract,
  Task1GeneralGenerationLLMSchema,
  type Task1GeneralGenerationContract,
} from "@/lib/gemini/schemas/task1General";
import {
  buildTask1AcademicGeneratorSystemPrompt,
  buildTask1AcademicGeneratorUserPrompt,
  buildTask1GeneralGeneratorSystemPrompt,
  buildTask1GeneralGeneratorUserPrompt,
  buildTask2GeneratorSystemPrompt,
  buildTask2GeneratorUserPrompt,
} from "@/lib/prompts/generator";
import { computeQuestionDedupeHash, isDuplicateQuestion } from "./dedupe";

/**
 * Shared question generation + de-dup + persistence, used by both the
 * standalone /api/questions/generate route and /api/mock/writing/start
 * (which generates a Task1+Task2 pair for one timed mock).
 */

export type QuestionTaskType = "task1_academic" | "task1_general" | "task2";

export const PRISMA_TASK_TYPE: Record<
  QuestionTaskType,
  "WRITING_TASK1_ACADEMIC" | "WRITING_TASK1_GENERAL" | "WRITING_TASK2"
> = {
  task1_academic: "WRITING_TASK1_ACADEMIC",
  task1_general: "WRITING_TASK1_GENERAL",
  task2: "WRITING_TASK2",
};

const DIFFICULTY_MAP = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
const REGISTER_MAP = {
  formal: "FORMAL",
  semi_formal: "SEMI_FORMAL",
  informal: "INFORMAL",
} as const;

const MAX_GENERATION_ATTEMPTS = 3;
const DEDUPE_WINDOW = 20;

export type GeneratedContract =
  | QuestionGenerationContract
  | Task1AcademicGenerationContract
  | Task1GeneralGenerationContract;

export interface GenerateQuestionInput {
  taskType: QuestionTaskType;
  userId: string;
  testType?: "academic" | "general";
  difficulty?: "easy" | "medium" | "hard";
  register?: "formal" | "semi_formal" | "informal";
}

async function generateCandidate(
  input: GenerateQuestionInput,
  avoidTopics: string[],
): Promise<{ contract: GeneratedContract; hash: string }> {
  if (input.taskType === "task2") {
    const testType = input.testType ?? "academic";
    const systemPrompt = buildTask2GeneratorSystemPrompt();
    const userPrompt = buildTask2GeneratorUserPrompt({
      testType,
      difficulty: input.difficulty,
      avoidTopics,
    });
    const rawText = await generate(systemPrompt, userPrompt);
    const llmOutput = await structureFreeText(rawText, QuestionGenerationLLMSchema);
    const contract = assembleQuestionContract(llmOutput);
    return { contract, hash: computeQuestionDedupeHash(contract.topic_tag, contract.prompt) };
  }

  if (input.taskType === "task1_academic") {
    const systemPrompt = buildTask1AcademicGeneratorSystemPrompt();
    const userPrompt = buildTask1AcademicGeneratorUserPrompt({
      difficulty: input.difficulty,
      avoidTopics,
    });
    const rawText = await generate(systemPrompt, userPrompt);
    const llmOutput = await structureFreeText(rawText, Task1AcademicGenerationLLMSchema);
    const contract = assembleTask1AcademicContract(llmOutput);
    return { contract, hash: computeQuestionDedupeHash(contract.topic_tag, contract.prompt) };
  }

  // task1_general
  const systemPrompt = buildTask1GeneralGeneratorSystemPrompt();
  const userPrompt = buildTask1GeneralGeneratorUserPrompt({
    register: input.register,
    difficulty: input.difficulty,
    avoidTopics,
  });
  const rawText = await generate(systemPrompt, userPrompt);
  const llmOutput = await structureFreeText(rawText, Task1GeneralGenerationLLMSchema);
  const contract = assembleTask1GeneralContract(llmOutput);
  return { contract, hash: computeQuestionDedupeHash(contract.topic_tag, contract.prompt) };
}

export interface GeneratedQuestionResult {
  contract: GeneratedContract;
  questionId: string;
  wasDeduped: boolean;
}

export async function generateAndPersistQuestion(
  input: GenerateQuestionInput,
): Promise<GeneratedQuestionResult> {
  const prismaTaskType = PRISMA_TASK_TYPE[input.taskType];

  const recentQuestions = await prisma.question.findMany({
    where: { requestedByUserId: input.userId, taskType: prismaTaskType },
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

  let contract: GeneratedContract | null = null;
  let dedupeHash = "";
  let wasDeduped = false;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = await generateCandidate(input, avoidTopics);

    if (!isDuplicateQuestion(candidate.hash, recentHashes)) {
      contract = candidate.contract;
      dedupeHash = candidate.hash;
      break;
    }
    wasDeduped = true;
    avoidTopics.push(candidate.contract.topic_tag);
  }

  if (!contract) {
    throw new Error("Could not generate a sufficiently novel question after retries.");
  }

  const question = await prisma.question.create({
    data: {
      module: "WRITING",
      taskType: prismaTaskType,
      testType: contract.test_type === "academic" ? "ACADEMIC" : "GENERAL",
      prompt: contract.prompt,
      topic: contract.topic_tag,
      difficulty: DIFFICULTY_MAP[contract.difficulty],
      instructions: contract.instructions,
      expectedWordCount: contract.expected_word_count,
      timeLimitSeconds: contract.time_limit_seconds,
      chartSpec: "chart_spec" in contract ? contract.chart_spec : undefined,
      letterRegister: "register" in contract ? REGISTER_MAP[contract.register] : undefined,
      dedupeHash,
      requestedByUserId: input.userId,
      source: "GENERATED",
      modelId: GEMINI_MODELS.generation,
    },
  });

  return { contract, questionId: question.id, wasDeduped };
}
