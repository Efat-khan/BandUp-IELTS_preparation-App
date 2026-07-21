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
import { computeQuestionDedupeHash, isDuplicateQuestion } from "@/lib/questions/dedupe";

const DIFFICULTY_MAP = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
const MAX_GENERATION_ATTEMPTS = 3;
const DEDUPE_WINDOW = 20;

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

async function generatePart1(
  difficulty: "easy" | "medium" | "hard" | undefined,
  avoidTopics: string[],
): Promise<Part1Contract> {
  const systemPrompt = buildPart1GeneratorSystemPrompt();
  const userPrompt = buildPart1GeneratorUserPrompt({ difficulty, avoidTopics });
  const rawText = await generate(systemPrompt, userPrompt);
  const llmOutput = await structureFreeText(rawText, Part1GenerationLLMSchema);
  return assemblePart1Contract(llmOutput);
}

async function generatePart2(
  difficulty: "easy" | "medium" | "hard" | undefined,
  avoidTopics: string[],
): Promise<Part2Contract> {
  const systemPrompt = buildPart2GeneratorSystemPrompt();
  const userPrompt = buildPart2GeneratorUserPrompt({ difficulty, avoidTopics });
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

function part1DedupeHash(contract: Part1Contract): string {
  const topicKey = contract.topics.map((t) => t.topic).join("|");
  const questionKey = contract.topics.flatMap((t) => t.questions).join(" ");
  return computeQuestionDedupeHash(topicKey, questionKey);
}

function part2DedupeHash(contract: Part2Contract): string {
  return computeQuestionDedupeHash(contract.topic_tag, contract.cue_card_topic);
}

/** Fetches this user's recent dedupe hashes + topic labels for a given Speaking part, for de-dup and "avoid" prompting. */
async function fetchRecentSpeakingHistory(
  userId: string,
  taskType: "SPEAKING_PART1" | "SPEAKING_PART2",
): Promise<{ hashes: string[]; avoidTopics: string[] }> {
  const recent = await prisma.question.findMany({
    where: { requestedByUserId: userId, taskType },
    orderBy: { createdAt: "desc" },
    take: DEDUPE_WINDOW,
    select: { dedupeHash: true, topic: true },
  });
  return {
    hashes: recent.map((q) => q.dedupeHash).filter((h): h is string => Boolean(h)),
    avoidTopics: recent.map((q) => q.topic).filter((t): t is string => Boolean(t)),
  };
}

async function generatePart1WithDedupe(
  userId: string,
  difficulty?: "easy" | "medium" | "hard",
): Promise<{ contract: Part1Contract; hash: string }> {
  const { hashes, avoidTopics } = await fetchRecentSpeakingHistory(userId, "SPEAKING_PART1");
  let contract: Part1Contract | null = null;
  let hash = "";
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = await generatePart1(difficulty, avoidTopics);
    const candidateHash = part1DedupeHash(candidate);
    if (!isDuplicateQuestion(candidateHash, hashes)) {
      contract = candidate;
      hash = candidateHash;
      break;
    }
    avoidTopics.push(...candidate.topics.map((t) => t.topic));
  }
  if (!contract) throw new Error("Could not generate a sufficiently novel Part 1 set after retries.");
  return { contract, hash };
}

async function generatePart2WithDedupe(
  userId: string,
  difficulty?: "easy" | "medium" | "hard",
): Promise<{ contract: Part2Contract; hash: string }> {
  const { hashes, avoidTopics } = await fetchRecentSpeakingHistory(userId, "SPEAKING_PART2");
  let contract: Part2Contract | null = null;
  let hash = "";
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = await generatePart2(difficulty, avoidTopics);
    const candidateHash = part2DedupeHash(candidate);
    if (!isDuplicateQuestion(candidateHash, hashes)) {
      contract = candidate;
      hash = candidateHash;
      break;
    }
    avoidTopics.push(candidate.topic_tag);
  }
  if (!contract) throw new Error("Could not generate a sufficiently novel Part 2 cue card after retries.");
  return { contract, hash };
}

/**
 * Generates a full Speaking test (Part 1 + Part 2 cue card + Part 3
 * follow-ups tied to Part 2) and persists all three as Question rows plus
 * a SpeakingSession linking them. Part 1/Part 2 are de-duped against the
 * user's last 20 questions of that part (Part 3 always derives from
 * Part 2, so it never needs its own de-dup).
 */
export async function generateSpeakingSession(
  userId: string,
  difficulty?: "easy" | "medium" | "hard",
): Promise<GeneratedSpeakingSession> {
  const [{ contract: part1Contract, hash: part1Hash }, { contract: part2Contract, hash: part2Hash }] =
    await Promise.all([
      generatePart1WithDedupe(userId, difficulty),
      generatePart2WithDedupe(userId, difficulty),
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
        dedupeHash: part1Hash,
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
        dedupeHash: part2Hash,
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

export type SpeakingDrillPart = "part1" | "part2";

/**
 * Generates a single Part 1 or Part 2 question with no companion parts and
 * no SpeakingSession — the "quick drill" mode. Part 3 is intentionally not
 * offered as a solo drill since its questions are defined as extensions of
 * a Part 2 cue card, not a self-contained unit.
 */
export async function generateSpeakingDrillQuestion(
  userId: string,
  part: SpeakingDrillPart,
  difficulty?: "easy" | "medium" | "hard",
): Promise<SpeakingSessionQuestion<Part1Contract | Part2Contract>> {
  if (part === "part1") {
    const { contract, hash } = await generatePart1WithDedupe(userId, difficulty);
    const question = await prisma.question.create({
      data: {
        module: "SPEAKING",
        taskType: "SPEAKING_PART1",
        prompt: contract.topics.map((t) => t.topic).join(", "),
        difficulty: DIFFICULTY_MAP[contract.difficulty],
        instructions: contract.instructions,
        part1Topics: contract.topics,
        dedupeHash: hash,
        requestedByUserId: userId,
        source: "GENERATED",
        modelId: GEMINI_MODELS.generation,
      },
    });
    return { questionId: question.id, contract };
  }

  const { contract, hash } = await generatePart2WithDedupe(userId, difficulty);
  const question = await prisma.question.create({
    data: {
      module: "SPEAKING",
      taskType: "SPEAKING_PART2",
      prompt: contract.cue_card_topic,
      topic: contract.topic_tag,
      difficulty: DIFFICULTY_MAP[contract.difficulty],
      instructions: contract.instructions,
      cueCardPoints: { bulletPoints: contract.bullet_points, finalPrompt: contract.final_prompt },
      prepSeconds: contract.prep_seconds,
      speakingSeconds: contract.speaking_seconds,
      dedupeHash: hash,
      requestedByUserId: userId,
      source: "GENERATED",
      modelId: GEMINI_MODELS.generation,
    },
  });
  return { questionId: question.id, contract };
}
