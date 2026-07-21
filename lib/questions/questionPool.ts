import { prisma } from "@/lib/db";
import type { Difficulty, Question, TaskType, TestType } from "@/lib/generated/prisma/client";

/**
 * Shared question pool (cost control, spec Phase 5 §2): reusing a
 * previously-generated question across DIFFERENT users skips a Gemini
 * generation call entirely. Per-user de-dup is tracked via QuestionServed
 * (who has SEEN a question), which is deliberately separate from
 * Question.requestedByUserId (who originally caused it to be generated) —
 * that separation is what makes cross-user reuse safe: a question served
 * to user B is recorded against user B's own history, so neither user can
 * be served their own recent question again, regardless of who it was
 * generated for originally.
 */

const DEFAULT_WINDOW = 20;
const POOL_SAMPLE_SIZE = 25;

export interface RecentServedHistory {
  hashes: string[];
  topics: string[];
}

/** This user's recent dedupe hashes + topic labels for a task type, read from QuestionServed (not Question.requestedByUserId). */
export async function fetchRecentServedHistory(
  userId: string,
  taskType: TaskType,
  window: number = DEFAULT_WINDOW,
): Promise<RecentServedHistory> {
  const served = await prisma.questionServed.findMany({
    where: { userId, question: { taskType } },
    orderBy: { createdAt: "desc" },
    take: window,
    select: { question: { select: { dedupeHash: true, topic: true } } },
  });
  return {
    hashes: served.map((s) => s.question.dedupeHash).filter((h): h is string => Boolean(h)),
    topics: served.map((s) => s.question.topic).filter((t): t is string => Boolean(t)),
  };
}

/** Records that a question (freshly generated or pool-reused) was handed to this user. */
export async function recordServed(userId: string, questionId: string): Promise<void> {
  await prisma.questionServed.create({ data: { userId, questionId } });
}

export interface PoolLookupFilter {
  taskType: TaskType;
  excludeHashes: string[];
  testType?: TestType;
  difficulty?: Difficulty;
}

/**
 * Finds an existing generated question this user hasn't seen recently,
 * regardless of which user it was originally generated for. Returns null
 * if nothing eligible exists yet — the caller falls back to generating
 * fresh via Gemini.
 */
export async function findPooledQuestion(filter: PoolLookupFilter): Promise<Question | null> {
  const rows = await prisma.question.findMany({
    where: {
      taskType: filter.taskType,
      source: "GENERATED",
      dedupeHash: { not: null, notIn: filter.excludeHashes },
      ...(filter.testType ? { testType: filter.testType } : {}),
      ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    },
    take: POOL_SAMPLE_SIZE,
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)];
}
