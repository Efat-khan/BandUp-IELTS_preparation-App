import { prisma } from "@/lib/db";
import { EVALUATOR_VERSION } from "@/lib/scoring/evaluatorVersion";

/**
 * Recomputes and upserts the daily Progress rollup for a user+module+date
 * from scratch (rather than incrementally averaging, which would drift).
 * Called after every scored submission (standalone, mock, or Speaking
 * session) so the progress dashboard always reflects committed data.
 */

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export interface UpdateProgressInput {
  userId: string;
  module: "WRITING" | "SPEAKING";
  /** Any timestamp within the day to roll up — usually the submission's createdAt. */
  date: Date;
}

export async function updateProgress(input: UpdateProgressInput): Promise<void> {
  const dayStart = startOfUtcDay(input.date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Canonical (pass 0) scores only — never the raw double-pass audit rows.
  const scores = await prisma.score.findMany({
    where: {
      pass: 0,
      submission: {
        userId: input.userId,
        module: input.module,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    },
    include: { submission: true },
  });

  if (scores.length === 0) return;

  const submissionsById = new Map<string, (typeof scores)[number]["submission"]>();
  for (const score of scores) submissionsById.set(score.submissionId, score.submission);
  const submissionsForDay = [...submissionsById.values()];

  const overallValues = submissionsForDay
    .map((s) => (s.overallUnrounded !== null ? Number(s.overallUnrounded) : null))
    .filter((v): v is number => v !== null);
  const avgOverall =
    overallValues.length > 0 ? overallValues.reduce((a, b) => a + b, 0) / overallValues.length : null;

  const criterionSums = new Map<string, { sum: number; count: number }>();
  for (const score of scores) {
    const entry = criterionSums.get(score.criterion) ?? { sum: 0, count: 0 };
    entry.sum += Number(score.score);
    entry.count += 1;
    criterionSums.set(score.criterion, entry);
  }
  const criterionAverages: Record<string, number> = {};
  for (const [criterion, { sum, count }] of criterionSums) {
    criterionAverages[criterion] = sum / count;
  }

  const timeValues = submissionsForDay
    .map((s) => s.timeSpentSeconds)
    .filter((v): v is number => v !== null && v !== undefined);
  const avgTimeSpentSeconds =
    timeValues.length > 0
      ? Math.round(timeValues.reduce((a, b) => a + b, 0) / timeValues.length)
      : null;

  const latestVersion =
    [...scores].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.evaluatorVersion ??
    EVALUATOR_VERSION;

  await prisma.progress.upsert({
    where: {
      userId_module_date: { userId: input.userId, module: input.module, date: dayStart },
    },
    create: {
      userId: input.userId,
      module: input.module,
      date: dayStart,
      submissionsCount: submissionsForDay.length,
      avgOverall,
      criterionAverages,
      avgTimeSpentSeconds,
      evaluatorVersion: latestVersion,
    },
    update: {
      submissionsCount: submissionsForDay.length,
      avgOverall,
      criterionAverages,
      avgTimeSpentSeconds,
      evaluatorVersion: latestVersion,
    },
  });
}
