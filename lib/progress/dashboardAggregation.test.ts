import { describe, expect, it } from "vitest";
import {
  computeMilestones,
  computeStreaks,
  computeWeightedAverageTime,
} from "./dashboardAggregation";

function utc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

describe("computeStreaks", () => {
  it("returns zeros for no activity", () => {
    expect(computeStreaks([], utc("2026-07-21"))).toEqual({ current: 0, longest: 0 });
  });

  it("counts a single active day as a streak of 1 if it's today", () => {
    expect(computeStreaks([utc("2026-07-21")], utc("2026-07-21"))).toEqual({
      current: 1,
      longest: 1,
    });
  });

  it("finds a consecutive current streak ending today", () => {
    const dates = [utc("2026-07-19"), utc("2026-07-20"), utc("2026-07-21")];
    expect(computeStreaks(dates, utc("2026-07-21"))).toEqual({ current: 3, longest: 3 });
  });

  it("still counts as current if the last active day was yesterday", () => {
    const dates = [utc("2026-07-19"), utc("2026-07-20")];
    expect(computeStreaks(dates, utc("2026-07-21"))).toEqual({ current: 2, longest: 2 });
  });

  it("resets current to 0 once more than a day has passed since the last activity", () => {
    const dates = [utc("2026-07-10"), utc("2026-07-11")];
    expect(computeStreaks(dates, utc("2026-07-21"))).toEqual({ current: 0, longest: 2 });
  });

  it("remembers the longest streak even after it's broken", () => {
    const dates = [
      utc("2026-07-01"),
      utc("2026-07-02"),
      utc("2026-07-03"),
      utc("2026-07-04"),
      utc("2026-07-20"),
      utc("2026-07-21"),
    ];
    expect(computeStreaks(dates, utc("2026-07-21"))).toEqual({ current: 2, longest: 4 });
  });

  it("dedupes multiple entries on the same day", () => {
    const dates = [utc("2026-07-21"), utc("2026-07-21"), utc("2026-07-20")];
    expect(computeStreaks(dates, utc("2026-07-21"))).toEqual({ current: 2, longest: 2 });
  });
});

describe("computeWeightedAverageTime", () => {
  it("returns null when there is no time data", () => {
    expect(computeWeightedAverageTime([])).toBeNull();
    expect(computeWeightedAverageTime([{ avgTimeSpentSeconds: null, submissionsCount: 3 }])).toBeNull();
  });

  it("weights by submissions count rather than averaging the daily averages", () => {
    const rows = [
      { avgTimeSpentSeconds: 600, submissionsCount: 1 },
      { avgTimeSpentSeconds: 1200, submissionsCount: 4 },
    ];
    // (600*1 + 1200*4) / 5 = 1080, not the naive (600+1200)/2 = 900
    expect(computeWeightedAverageTime(rows)).toBe(1080);
  });

  it("ignores null-average days but keeps the rest", () => {
    const rows = [
      { avgTimeSpentSeconds: null, submissionsCount: 2 },
      { avgTimeSpentSeconds: 900, submissionsCount: 2 },
    ];
    expect(computeWeightedAverageTime(rows)).toBe(900);
  });
});

describe("computeMilestones", () => {
  it("returns no milestones for a brand new user", () => {
    const milestones = computeMilestones({
      trend: { WRITING: [], SPEAKING: [] },
      currentStreak: 0,
      attemptsTotal: 0,
    });
    expect(milestones).toEqual([]);
  });

  it("reports the highest attempt and streak milestones only, not every threshold crossed", () => {
    const milestones = computeMilestones({
      trend: { WRITING: [], SPEAKING: [] },
      currentStreak: 10,
      attemptsTotal: 30,
    });
    expect(milestones).toContainEqual({ id: "attempts-25", label: "25+ scored attempts logged" });
    expect(milestones).toContainEqual({ id: "streak-7", label: "7-day practice streak" });
    expect(milestones.some((m) => m.id === "attempts-10")).toBe(false);
  });

  it("flags a half-band-or-more improvement since the first recorded day", () => {
    const milestones = computeMilestones({
      trend: {
        WRITING: [{ avgOverall: 5.5 }, { avgOverall: 6.0 }, { avgOverall: 6.5 }],
        SPEAKING: [],
      },
      currentStreak: 0,
      attemptsTotal: 3,
    });
    expect(milestones).toContainEqual({
      id: "improvement-WRITING",
      label: "Writing band up from 5.5 to 6.5 since you started",
    });
  });

  it("does not flag improvement below half a band", () => {
    const milestones = computeMilestones({
      trend: { WRITING: [{ avgOverall: 6.0 }, { avgOverall: 6.2 }], SPEAKING: [] },
      currentStreak: 0,
      attemptsTotal: 2,
    });
    expect(milestones.some((m) => m.id === "improvement-WRITING")).toBe(false);
  });

  it("flags a personal best only when the latest value is the best one", () => {
    const milestones = computeMilestones({
      trend: { WRITING: [], SPEAKING: [{ avgOverall: 6.0 }, { avgOverall: 7.5 }, { avgOverall: 7.0 }] },
      currentStreak: 0,
      attemptsTotal: 3,
    });
    expect(milestones.some((m) => m.id === "personal-best-SPEAKING")).toBe(false);
  });

  it("flags a personal best when the latest attempt is the strongest yet", () => {
    const milestones = computeMilestones({
      trend: { WRITING: [], SPEAKING: [{ avgOverall: 6.0 }, { avgOverall: 6.5 }, { avgOverall: 7.5 }] },
      currentStreak: 0,
      attemptsTotal: 3,
    });
    expect(milestones).toContainEqual({
      id: "personal-best-SPEAKING",
      label: "New personal best in Speaking: band 7.5",
    });
  });
});
