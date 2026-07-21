import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/demoUser";
import {
  computeMilestones,
  computeStreaks,
  computeWeightedAverageTime,
} from "@/lib/progress/dashboardAggregation";
import { computeCriterionBuckets } from "@/lib/progress/weaknessDrill";
import { EVALUATOR_VERSION } from "@/lib/scoring/evaluatorVersion";

export const dynamic = "force-dynamic";

type ModuleKey = "WRITING" | "SPEAKING";

const WRITING_HEATMAP_CRITERIA: Array<{ key: string; label: string; source: string[] }> = [
  { key: "TR_TA", label: "Task Achievement / Response", source: ["TR", "TA"] },
  { key: "CC", label: "Coherence & Cohesion", source: ["CC"] },
  { key: "LR", label: "Lexical Resource", source: ["LR"] },
  { key: "GRA", label: "Grammatical Range & Accuracy", source: ["GRA"] },
];
const SPEAKING_HEATMAP_CRITERIA: Array<{ key: string; label: string; source: string[] }> = [
  { key: "FC", label: "Fluency & Coherence", source: ["FC"] },
  { key: "LR", label: "Lexical Resource", source: ["LR"] },
  { key: "GRA", label: "Grammatical Range & Accuracy", source: ["GRA"] },
  { key: "PR", label: "Pronunciation", source: ["PR"] },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    return await handleGet(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

async function handleGet(request: NextRequest): Promise<Response> {
  const requestedUserId = request.nextUrl.searchParams.get("userId");
  const userId = await resolveUserId(requestedUserId);

  const allRows = await prisma.progress.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  // Score/band aggregates never blend evaluator versions; activity metrics
  // (streaks, attempts, time) are version-agnostic since they don't score anything.
  const currentVersionRows = allRows.filter((r) => r.evaluatorVersion === EVALUATOR_VERSION);
  const excludedDays = allRows.length - currentVersionRows.length;

  const trend: Record<ModuleKey, Array<{ date: string; avgOverall: number | null; submissionsCount: number }>> =
    { WRITING: [], SPEAKING: [] };
  const criterionTrend: Record<
    string,
    Array<{ date: string; avgBand: number }>
  > = {};

  for (const row of currentVersionRows) {
    const moduleKey = row.module as ModuleKey;
    trend[moduleKey].push({
      date: isoDate(row.date),
      avgOverall: row.avgOverall !== null ? Number(row.avgOverall) : null,
      submissionsCount: row.submissionsCount,
    });

    const criterionAverages = (row.criterionAverages as Record<string, number> | null) ?? {};
    for (const [criterion, avgBand] of Object.entries(criterionAverages)) {
      const trendKey = `${moduleKey}:${criterion}`;
      (criterionTrend[trendKey] ??= []).push({ date: isoDate(row.date), avgBand: Number(avgBand) });
    }
  }

  const buckets = await computeCriterionBuckets(userId);
  const bucketByModuleCriterion = new Map(buckets.map((b) => [`${b.module}:${b.criterion}`, b]));

  function buildHeatmapRow(
    moduleKey: ModuleKey,
    cells: Array<{ key: string; label: string; source: string[] }>,
  ) {
    return cells.map(({ key, label, source }) => {
      let sum = 0;
      let count = 0;
      for (const criterion of source) {
        const bucket = bucketByModuleCriterion.get(`${moduleKey}:${criterion}`);
        if (bucket) {
          sum += bucket.avgBand * bucket.attemptCount;
          count += bucket.attemptCount;
        }
      }
      return {
        criterion: key,
        label,
        avgBand: count > 0 ? sum / count : null,
        attemptCount: count,
      };
    });
  }

  const heatmap = {
    WRITING: buildHeatmapRow("WRITING", WRITING_HEATMAP_CRITERIA),
    SPEAKING: buildHeatmapRow("SPEAKING", SPEAKING_HEATMAP_CRITERIA),
  };

  const activeDates = allRows.map((r) => r.date);
  const streak = computeStreaks(activeDates, new Date());

  const attemptsCount: Record<ModuleKey, number> = { WRITING: 0, SPEAKING: 0 };
  for (const row of allRows) {
    attemptsCount[row.module as ModuleKey] += row.submissionsCount;
  }
  const attemptsTotal = attemptsCount.WRITING + attemptsCount.SPEAKING;

  const averageTimeSpentSeconds: Record<ModuleKey, number | null> = {
    WRITING: computeWeightedAverageTime(
      allRows.filter((r) => r.module === "WRITING").map((r) => ({
        avgTimeSpentSeconds: r.avgTimeSpentSeconds,
        submissionsCount: r.submissionsCount,
      })),
    ),
    SPEAKING: computeWeightedAverageTime(
      allRows.filter((r) => r.module === "SPEAKING").map((r) => ({
        avgTimeSpentSeconds: r.avgTimeSpentSeconds,
        submissionsCount: r.submissionsCount,
      })),
    ),
  };

  const milestones = computeMilestones({
    trend: { WRITING: trend.WRITING, SPEAKING: trend.SPEAKING },
    currentStreak: streak.current,
    attemptsTotal,
  });

  return Response.json({
    evaluatorVersion: EVALUATOR_VERSION,
    excludedDays,
    hasAnyData: allRows.length > 0,
    trend,
    criterionTrend,
    heatmap,
    streak,
    attemptsCount: { ...attemptsCount, total: attemptsTotal },
    averageTimeSpentSeconds,
    milestones,
  });
}
