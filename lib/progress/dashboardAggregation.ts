/**
 * Pure aggregation helpers for the progress dashboard — no DB access, so
 * they're fully unit-testable. app/api/progress/route.ts does the querying
 * and hands plain data in.
 */

export interface StreakResult {
  current: number;
  longest: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY);
}

/**
 * `current` only counts if the most recent active day is today or
 * yesterday (relative to `now`) — otherwise the streak has lapsed and
 * reads as 0, even though `longest` still remembers the best run.
 */
export function computeStreaks(activeDates: Date[], now: Date): StreakResult {
  if (activeDates.length === 0) return { current: 0, longest: 0 };

  const dayNumbers = [...new Set(activeDates.map(toUtcDayNumber))].sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayNumbers.length; i++) {
    run = dayNumbers[i] === dayNumbers[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayNum = toUtcDayNumber(now);
  const lastActiveDay = dayNumbers[dayNumbers.length - 1];
  let current = 0;
  if (lastActiveDay === todayNum || lastActiveDay === todayNum - 1) {
    current = 1;
    for (let i = dayNumbers.length - 1; i > 0; i--) {
      if (dayNumbers[i] === dayNumbers[i - 1] + 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}

/** Weighted by each day's submission count, so a single-attempt day doesn't skew the average as much as a 5-attempt day. */
export function computeWeightedAverageTime(
  rows: Array<{ avgTimeSpentSeconds: number | null; submissionsCount: number }>,
): number | null {
  let weightedSum = 0;
  let totalCount = 0;
  for (const row of rows) {
    if (row.avgTimeSpentSeconds === null) continue;
    weightedSum += row.avgTimeSpentSeconds * row.submissionsCount;
    totalCount += row.submissionsCount;
  }
  return totalCount === 0 ? null : Math.round(weightedSum / totalCount);
}

export interface Milestone {
  id: string;
  label: string;
}

export interface DashboardMilestoneInput {
  trend: Record<"WRITING" | "SPEAKING", Array<{ avgOverall: number | null }>>;
  currentStreak: number;
  attemptsTotal: number;
}

const ATTEMPT_MILESTONES = [5, 10, 25, 50, 100, 250];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const MODULE_LABELS: Record<"WRITING" | "SPEAKING", string> = { WRITING: "Writing", SPEAKING: "Speaking" };

export function computeMilestones(input: DashboardMilestoneInput): Milestone[] {
  const milestones: Milestone[] = [];

  const highestAttemptMilestone = [...ATTEMPT_MILESTONES].reverse().find((m) => input.attemptsTotal >= m);
  if (highestAttemptMilestone) {
    milestones.push({
      id: `attempts-${highestAttemptMilestone}`,
      label: `${highestAttemptMilestone}+ scored attempts logged`,
    });
  }

  const highestStreakMilestone = [...STREAK_MILESTONES].reverse().find((m) => input.currentStreak >= m);
  if (highestStreakMilestone) {
    milestones.push({
      id: `streak-${highestStreakMilestone}`,
      label: `${highestStreakMilestone}-day practice streak`,
    });
  }

  for (const moduleKey of ["WRITING", "SPEAKING"] as const) {
    const values = input.trend[moduleKey]
      .map((d) => d.avgOverall)
      .filter((v): v is number => v !== null);
    if (values.length < 2) continue;

    const first = values[0];
    const latest = values[values.length - 1];
    const best = Math.max(...values);

    if (best - first >= 0.5) {
      milestones.push({
        id: `improvement-${moduleKey}`,
        label: `${MODULE_LABELS[moduleKey]} band up from ${first.toFixed(1)} to ${best.toFixed(1)} since you started`,
      });
    }
    if (latest >= best && latest > first) {
      milestones.push({
        id: `personal-best-${moduleKey}`,
        label: `New personal best in ${MODULE_LABELS[moduleKey]}: band ${latest.toFixed(1)}`,
      });
    }
  }

  return milestones;
}
