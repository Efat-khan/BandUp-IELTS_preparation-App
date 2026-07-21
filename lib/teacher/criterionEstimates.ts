export interface ScoreForEstimate {
  module: "WRITING" | "SPEAKING";
  criterion: string;
  score: number;
  createdAt: Date;
}

export const ESTIMATE_RECENCY_N = 3;

/**
 * Current per-criterion band estimates, keyed "MODULE:CRITERION": the mean
 * of the last N canonical scores per bucket, so the estimate tracks where
 * the learner is NOW rather than their all-time average. Pure — the DB
 * loader lives in postSession.ts.
 */
export function computeRecencyEstimates(
  scores: ScoreForEstimate[],
  lastN: number = ESTIMATE_RECENCY_N,
): Record<string, number> {
  const buckets = new Map<string, ScoreForEstimate[]>();
  for (const score of scores) {
    const key = `${score.module}:${score.criterion}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(score);
  }

  const estimates: Record<string, number> = {};
  for (const [key, bucket] of buckets) {
    const recent = [...bucket]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, lastN);
    estimates[key] = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
  }
  return estimates;
}
