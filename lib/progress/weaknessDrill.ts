import { prisma } from "@/lib/db";
import { EVALUATOR_VERSION } from "@/lib/scoring/evaluatorVersion";

export interface CriterionBucket {
  criterion: string;
  module: "WRITING" | "SPEAKING";
  avgBand: number;
  attemptCount: number;
}

export type WeakestCriterionResult = CriterionBucket;

/**
 * Averages every canonical (pass 0) score into per-module-per-criterion
 * buckets. Scoped to a single evaluatorVersion (defaulting to the current
 * one) so a prompt/descriptor change never quietly blends with older scores
 * — the same rule the progress trend lines follow (see evaluatorVersion.ts).
 */
export async function computeCriterionBuckets(
  userId: string,
  evaluatorVersion: string = EVALUATOR_VERSION,
): Promise<CriterionBucket[]> {
  const scores = await prisma.score.findMany({
    where: { pass: 0, evaluatorVersion, submission: { userId } },
    select: { criterion: true, score: true, submission: { select: { module: true } } },
  });

  const buckets = new Map<string, { sum: number; count: number; module: "WRITING" | "SPEAKING" }>();
  for (const score of scores) {
    const key = `${score.submission.module}:${score.criterion}`;
    const entry = buckets.get(key) ?? { sum: 0, count: 0, module: score.submission.module };
    entry.sum += Number(score.score);
    entry.count += 1;
    buckets.set(key, entry);
  }

  return [...buckets.entries()].map(([key, { sum, count, module }]) => ({
    criterion: key.split(":")[1],
    module,
    avgBand: sum / count,
    attemptCount: count,
  }));
}

/**
 * Finds the user's lowest-average-band criterion across all their scored
 * submissions (canonical pass 0 only, current evaluator version only). Since
 * CC/LR/GRA are scored in both Writing and Speaking, the module is read
 * directly off each Score's own submission rather than guessed — a low
 * Speaking LR average and a low Writing LR average are tracked as distinct
 * weaknesses.
 */
export async function findWeakestCriterion(userId: string): Promise<WeakestCriterionResult | null> {
  const buckets = await computeCriterionBuckets(userId);
  if (buckets.length === 0) return null;
  return buckets.reduce((weakest, b) => (b.avgBand < weakest.avgBand ? b : weakest));
}
