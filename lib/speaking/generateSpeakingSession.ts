import { prisma } from "@/lib/db";
import { generate, structureFreeText } from "@/lib/gemini/client";
import { GEMINI_MODELS } from "@/lib/gemini/models";
import {
  assemblePart1Contract,
  assemblePart2Contract,
  assemblePart3Contract,
  Part1GenerationLLMSchema,
  Part2GenerationLLMSchema,
  Part3GenerationLLMSchema,
  type Part1Contract,
  type Part2Contract,
  type Part3Contract,
} from "@/lib/gemini/schemas/speakingQuestions";
import {
  buildPart1GeneratorSystemPrompt,
  buildPart1GeneratorUserPrompt,
  buildPart2GeneratorSystemPrompt,
  buildPart2GeneratorUserPrompt,
  buildPart3GeneratorSystemPrompt,
  buildPart3GeneratorUserPrompt,
} from "@/lib/prompts/speakingGenerator";

const DIFFICULTY_MAP = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;

export interface SpeakingSessionQuestion<T> {
  questionId: string;
  contract: T;
}

export interface GeneratedSpeakingSession {
  sessionId: string;
  part1: SpeakingSessionQuestion<Part1Contract>;
  part2: SpeakingSessionQuestion<Part2Contract>;
  part3: SpeakingSessionQuestion<Part3Contract>;
}

async function generatePart1(difficulty?: "easy" | "medium" | "hard"): Promise<Part1Contract> {
  const systemPrompt = buildPart1GeneratorSystemPrompt();
  const userPrompt = buildPart1GeneratorUserPrompt({ difficulty, avoidTopics: [] });
  const rawText = await generate(systemPrompt, userPrompt);
  const llmOutput = await structureFreeText(rawText, Part1GenerationLLMSchema);
  return assemblePart1Contract(llmOutput);
}

async function generatePart2(difficulty?: "easy" | "medium" | "hard"): Promise<Part2Contract> {
  const systemPrompt = buildPart2GeneratorSystemPrompt();
  const userPrompt = buildPart2GeneratorUserPrompt({ difficulty, avoidTopics: [] });
  const rawText = await generate(systemPrompt, userPrompt);
  const llmOutput = await structureFreeText(rawText, Part2GenerationLLMSchema);
  return assemblePart2Contract(llmOutput);
}

async function generatePart3(part2: Part2Contract): Promise<Part3Contract> {
  const systemPrompt = buildPart3GeneratorSystemPrompt();
  const userPrompt = buildPart3GeneratorUserPrompt({
    cueCardTopic: part2.cue_card_topic,
    bulletPoints: part2.bullet_points,
  });
  const rawText = await generate(systemPrompt, userPrompt);
  const llmOutput = await structureFreeText(rawText, Part3GenerationLLMSchema);
  return assemblePart3Contract(llmOutput);
}

/**
 * Generates a full Speaking test (Part 1 + Part 2 cue card + Part 3
 * follow-ups tied to Part 2) and persists all three as Question rows plus
 * a SpeakingSession linking them. De-dup against recent topics is not yet
 * implemented for Speaking (only Writing has it, per the Phase 1 spec) —
 * a reasonable follow-up if repeats become an issue in practice.
 */
export async function generateSpeakingSession(
  userId: string,
  difficulty?: "easy" | "medium" | "hard",
): Promise<GeneratedSpeakingSession> {
  const [part1Contract, part2Contract] = await Promise.all([
    generatePart1(difficulty),
    generatePart2(difficulty),
  ]);
  const part3Contract = await generatePart3(part2Contract);

  const [part1Question, part2Question, part3Question] = await Promise.all([
    prisma.question.create({
      data: {
        module: "SPEAKING",
        taskType: "SPEAKING_PART1",
        prompt: part1Contract.topics.map((t) => t.topic).join(", "),
        difficulty: DIFFICULTY_MAP[part1Contract.difficulty],
        instructions: part1Contract.instructions,
        part1Topics: part1Contract.topics,
        requestedByUserId: userId,
        source: "GENERATED",
        modelId: GEMINI_MODELS.generation,
      },
    }),
    prisma.question.create({
      data: {
        module: "SPEAKING",
        taskType: "SPEAKING_PART2",
        prompt: part2Contract.cue_card_topic,
        topic: part2Contract.topic_tag,
        difficulty: DIFFICULTY_MAP[part2Contract.difficulty],
        instructions: part2Contract.instructions,
        cueCardPoints: { bulletPoints: part2Contract.bullet_points, finalPrompt: part2Contract.final_prompt },
        prepSeconds: part2Contract.prep_seconds,
        speakingSeconds: part2Contract.speaking_seconds,
        requestedByUserId: userId,
        source: "GENERATED",
        modelId: GEMINI_MODELS.generation,
      },
    }),
    prisma.question.create({
      data: {
        module: "SPEAKING",
        taskType: "SPEAKING_PART3",
        prompt: part3Contract.questions.join(" / "),
        instructions: part3Contract.instructions,
        part3FollowUps: part3Contract.questions,
        requestedByUserId: userId,
        source: "GENERATED",
        modelId: GEMINI_MODELS.generation,
      },
    }),
  ]);

  const session = await prisma.speakingSession.create({
    data: {
      userId,
      part1QuestionId: part1Question.id,
      part2QuestionId: part2Question.id,
      part3QuestionId: part3Question.id,
    },
  });

  return {
    sessionId: session.id,
    part1: { questionId: part1Question.id, contract: part1Contract },
    part2: { questionId: part2Question.id, contract: part2Contract },
    part3: { questionId: part3Question.id, contract: part3Contract },
  };
}
