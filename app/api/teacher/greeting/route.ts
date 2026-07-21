import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/demoUser";
import { teachFreeText } from "@/lib/gemini/client";
import { errorResponse } from "@/lib/http/errorResponse";
import { buildGreetingUserPrompt, TUTOR_SYSTEM_PROMPT } from "@/lib/prompts/tutor";
import { computeMilestones, computeStreaks } from "@/lib/progress/dashboardAggregation";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import { EVALUATOR_VERSION } from "@/lib/scoring/evaluatorVersion";
import { loadTeacherContext } from "@/lib/teacher/orchestrator";

export const dynamic = "force-dynamic";

/** The same milestone computation the dashboard uses — the tutor celebrates real numbers, never invented ones. */
async function loadMilestoneLines(userId: string): Promise<string[]> {
  const rows = await prisma.progress.findMany({
    where: { userId, evaluatorVersion: EVALUATOR_VERSION },
    orderBy: { date: "asc" },
  });
  const trend: Record<"WRITING" | "SPEAKING", Array<{ avgOverall: number | null }>> = {
    WRITING: [],
    SPEAKING: [],
  };
  let attemptsTotal = 0;
  for (const row of rows) {
    trend[row.module as "WRITING" | "SPEAKING"].push({
      avgOverall: row.avgOverall !== null ? Number(row.avgOverall) : null,
    });
    attemptsTotal += row.submissionsCount;
  }
  const streak = computeStreaks(rows.map((r) => r.date), new Date());
  return computeMilestones({ trend, currentStreak: streak.current, attemptsTotal }).map(
    (m) => m.label,
  );
}

export async function GET(request: NextRequest) {
  try {
    const limited = enforceRateLimit(RATE_LIMITS.chat, request);
    if (limited) return limited;
    const userId = await resolveUserId(request.nextUrl.searchParams.get("userId"));
    const [ctx, milestoneLines] = await Promise.all([
      loadTeacherContext(userId),
      loadMilestoneLines(userId),
    ]);
    const greeting = await teachFreeText(
      TUTOR_SYSTEM_PROMPT,
      buildGreetingUserPrompt(ctx, milestoneLines),
    );
    return Response.json({ greeting, milestones: milestoneLines });
  } catch (error) {
    return errorResponse(error);
  }
}
