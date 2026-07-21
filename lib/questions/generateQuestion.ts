import { prisma } from "@/lib/db";
import type { Question } from "@/lib/generated/prisma/client";
import { generate, structureFreeText } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import type { ChartSpec } from "@/lib/gemini/schemas/chartSpec";
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
import { fetchRecentServedHistory, findPooledQuestion, recordServed } from "./questionPool";

/**
 * Shared question generation + de-dup + persistence, used by both the
 * standalone /api/questions/generate route and /api/mock/writing/start
 * (which generates a Task1+Task2 pair for one timed mock).
 *
 * Cost control (Phase 5 §2): before calling Gemini, first checks the
 * shared pool of already-generated questions (lib/questions/questionPool.ts)
 * for one this user hasn't seen recently — reusing it skips generation
 * entirely. Only generates fresh when the pool has nothing eligible.
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
const REVERSE_DIFFICULTY_MAP = { EASY: "easy", MEDIUM: "medium", HARD: "hard" } as const;
const REGISTER_MAP = {
  formal: "FORMAL",
  semi_formal: "SEMI_FORMAL",
  informal: "INFORMAL",
} as const;
const REVERSE_REGISTER_MAP = {
  FORMAL: "formal",
  SEMI_FORMAL: "semi_formal",
  INFORMAL: "informal",
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

/** Faithfully rebuilds a generation contract from a persisted Question row — every field the contract needs was already stored, so no data is lost by skipping Gemini. */
export function reconstructWritingContract(row: Question): GeneratedContract {
  const difficulty = REVERSE_DIFFICULTY_MAP[row.difficulty];
  const topic_tag = row.topic ?? "";
  const instructions = row.instructions ?? "";

  if (row.taskType === "WRITING_TASK2") {
    return {
      skill: "writing",
      task: "task2",
      test_type: row.testType === "GENERAL" ? "general" : "academic",
      topic_tag,
      difficulty,
      prompt: row.prompt,
      instructions,
      expected_word_count: 250,
      time_limit_seconds: 2400,
    };
  }

  if (row.taskType === "WRITING_TASK1_ACADEMIC") {
    return {
      skill: "writing",
      task: "task1",
      test_type: "academic",
      topic_tag,
      difficulty,
      chart_spec: row.chartSpec as unknown as ChartSpec,
      prompt: row.prompt,
      instructions,
      expected_word_count: 150,
      time_limit_seconds: 1200,
    };
  }

  // WRITING_TASK1_GENERAL
  return {
    skill: "writing",
    task: "task1",
    test_type: "general",
    topic_tag,
    difficulty,
    register: REVERSE_REGISTER_MAP[row.letterRegister ?? "FORMAL"],
    prompt: row.prompt,
    instructions,
    expected_word_count: 150,
    time_limit_seconds: 1200,
  };
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
  /** True when served from the shared pool — no Gemini generation call was made. */
  servedFromPool: boolean;
}

export async function generateAndPersistQuestion(
  input: GenerateQuestionInput,
): Promise<GeneratedQuestionResult> {
  const prismaTaskType = PRISMA_TASK_TYPE[input.taskType];

  const { hashes: recentHashes, topics: recentTopics } = await fetchRecentServedHistory(
    input.userId,
    prismaTaskType,
    DEDUPE_WINDOW,
  );

  const pooled = await findPooledQuestion({
    taskType: prismaTaskType,
    excludeHashes: recentHashes,
    testType:
      input.taskType === "task2"
        ? input.testType === "general"
          ? "GENERAL"
          : "ACADEMIC"
        : undefined,
    difficulty: input.difficulty ? DIFFICULTY_MAP[input.difficulty] : undefined,
  });
  if (pooled) {
    await recordServed(input.userId, pooled.id);
    return {
      contract: reconstructWritingContract(pooled),
      questionId: pooled.id,
      wasDeduped: false,
      servedFromPool: true,
    };
  }

  const avoidTopics = [...recentTopics];
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
  await recordServed(input.userId, question.id);

  return { contract, questionId: question.id, wasDeduped, servedFromPool: false };
}
