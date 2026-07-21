import { prisma } from "@/lib/db";
import type { Question } from "@/lib/generated/prisma/client";
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
import { fetchRecentServedHistory, findPooledQuestion, recordServed } from "@/lib/questions/questionPool";

const DIFFICULTY_MAP = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
const REVERSE_DIFFICULTY_MAP = { EASY: "easy", MEDIUM: "medium", HARD: "hard" } as const;
const MAX_GENERATION_ATTEMPTS = 3;
const DEDUPE_WINDOW = 20;

/** Faithfully rebuilds a Part 1 contract from a persisted Question row — reused across users to skip a Gemini call. */
function reconstructPart1Contract(row: Question): Part1Contract {
  return {
    skill: "speaking",
    part: "part1",
    topics: (row.part1Topics as unknown as Part1Contract["topics"]) ?? [],
    difficulty: REVERSE_DIFFICULTY_MAP[row.difficulty],
    instructions: row.instructions ?? "",
  };
}

/** Faithfully rebuilds a Part 2 contract from a persisted Question row — reused across users to skip a Gemini call. */
function reconstructPart2Contract(row: Question): Part2Contract {
  const cueCardPoints = row.cueCardPoints as unknown as
    | { bulletPoints: string[]; finalPrompt: string }
    | null;
  return {
    skill: "speaking",
    part: "part2",
    topic_tag: row.topic ?? "",
    difficulty: REVERSE_DIFFICULTY_MAP[row.difficulty],
    cue_card_topic: row.prompt,
    bullet_points: cueCardPoints?.bulletPoints ?? [],
    final_prompt: cueCardPoints?.finalPrompt ?? "",
    // Part 2 timing is always exactly 60s prep / 120s speaking (assemblePart2Contract never varies
    // it), so the contract's literal-typed fields are hardcoded rather than read back from the row.
    prep_seconds: 60,
    speaking_seconds: 120,
    instructions: row.instructions ?? "",
  };
}

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

interface DedupedGeneration<T> {
  contract: T;
  hash: string;
  /** Set when served from the shared pool instead of a fresh Gemini call — the caller reuses this row rather than creating a new one. */
  pooledQuestionId?: string;
}

async function generatePart1WithDedupe(
  userId: string,
  difficulty?: "easy" | "medium" | "hard",
): Promise<DedupedGeneration<Part1Contract>> {
  const { hashes, topics: avoidTopics } = await fetchRecentServedHistory(
    userId,
    "SPEAKING_PART1",
    DEDUPE_WINDOW,
  );

  const pooled = await findPooledQuestion({
    taskType: "SPEAKING_PART1",
    excludeHashes: hashes,
    difficulty: difficulty ? DIFFICULTY_MAP[difficulty] : undefined,
  });
  if (pooled && pooled.dedupeHash) {
    return { contract: reconstructPart1Contract(pooled), hash: pooled.dedupeHash, pooledQuestionId: pooled.id };
  }

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
): Promise<DedupedGeneration<Part2Contract>> {
  const { hashes, topics: avoidTopics } = await fetchRecentServedHistory(
    userId,
    "SPEAKING_PART2",
    DEDUPE_WINDOW,
  );

  const pooled = await findPooledQuestion({
    taskType: "SPEAKING_PART2",
    excludeHashes: hashes,
    difficulty: difficulty ? DIFFICULTY_MAP[difficulty] : undefined,
  });
  if (pooled && pooled.dedupeHash) {
    return { contract: reconstructPart2Contract(pooled), hash: pooled.dedupeHash, pooledQuestionId: pooled.id };
  }

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

/** Reuses the pooled row if present (recording it as served to this user), otherwise creates a fresh Part 1 Question row. */
async function getOrCreatePart1Question(
  userId: string,
  generated: DedupedGeneration<Part1Contract>,
): Promise<string> {
  if (generated.pooledQuestionId) {
    await recordServed(userId, generated.pooledQuestionId);
    return generated.pooledQuestionId;
  }
  const question = await prisma.question.create({
    data: {
      module: "SPEAKING",
      taskType: "SPEAKING_PART1",
      prompt: generated.contract.topics.map((t) => t.topic).join(", "),
      difficulty: DIFFICULTY_MAP[generated.contract.difficulty],
      instructions: generated.contract.instructions,
      part1Topics: generated.contract.topics,
      dedupeHash: generated.hash,
      requestedByUserId: userId,
      source: "GENERATED",
      modelId: GEMINI_MODELS.generation,
    },
  });
  await recordServed(userId, question.id);
  return question.id;
}

/** Reuses the pooled row if present (recording it as served to this user), otherwise creates a fresh Part 2 Question row. */
async function getOrCreatePart2Question(
  userId: string,
  generated: DedupedGeneration<Part2Contract>,
): Promise<string> {
  if (generated.pooledQuestionId) {
    await recordServed(userId, generated.pooledQuestionId);
    return generated.pooledQuestionId;
  }
  const question = await prisma.question.create({
    data: {
      module: "SPEAKING",
      taskType: "SPEAKING_PART2",
      prompt: generated.contract.cue_card_topic,
      topic: generated.contract.topic_tag,
      difficulty: DIFFICULTY_MAP[generated.contract.difficulty],
      instructions: generated.contract.instructions,
      cueCardPoints: {
        bulletPoints: generated.contract.bullet_points,
        finalPrompt: generated.contract.final_prompt,
      },
      prepSeconds: generated.contract.prep_seconds,
      speakingSeconds: generated.contract.speaking_seconds,
      dedupeHash: generated.hash,
      requestedByUserId: userId,
      source: "GENERATED",
      modelId: GEMINI_MODELS.generation,
    },
  });
  await recordServed(userId, question.id);
  return question.id;
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
  const [part1Generated, part2Generated] = await Promise.all([
    generatePart1WithDedupe(userId, difficulty),
    generatePart2WithDedupe(userId, difficulty),
  ]);
  const part1Contract = part1Generated.contract;
  const part2Contract = part2Generated.contract;
  const part3Contract = await generatePart3(part2Contract);

  const [part1QuestionId, part2QuestionId, part3Question] = await Promise.all([
    getOrCreatePart1Question(userId, part1Generated),
    getOrCreatePart2Question(userId, part2Generated),
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
      part1QuestionId,
      part2QuestionId,
      part3QuestionId: part3Question.id,
    },
  });

  return {
    sessionId: session.id,
    part1: { questionId: part1QuestionId, contract: part1Contract },
    part2: { questionId: part2QuestionId, contract: part2Contract },
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
    const generated = await generatePart1WithDedupe(userId, difficulty);
    const questionId = await getOrCreatePart1Question(userId, generated);
    return { questionId, contract: generated.contract };
  }

  const generated = await generatePart2WithDedupe(userId, difficulty);
  const questionId = await getOrCreatePart2Question(userId, generated);
  return { questionId, contract: generated.contract };
}
