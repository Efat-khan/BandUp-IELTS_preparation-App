import { describe, expect, it } from "vitest";
import {
  computeWeeksToExam,
  evaluateUnitProgress,
  nextUnitTarget,
  planLengthForExam,
  sequenceUnitsByImpact,
} from "./studyPlanEngine";

function input(
  module: "WRITING" | "SPEAKING",
  criterion: string,
  estimate: number,
  persistent = 0,
  worsening = 0,
) {
  return {
    module,
    criterion,
    estimate,
    persistentErrorFamilies: persistent,
    worseningErrorFamilies: worsening,
  };
}

describe("nextUnitTarget", () => {
  it("targets the next half-band at least 0.5 above baseline", () => {
    expect(nextUnitTarget(6.0)).toBe(6.5);
    expect(nextUnitTarget(6.3)).toBe(7.0);
    expect(nextUnitTarget(6.5)).toBe(7.0);
  });

  it("caps at band 9", () => {
    expect(nextUnitTarget(8.8)).toBe(9);
  });
});

describe("sequenceUnitsByImpact", () => {
  it("puts the weakest criterion first", () => {
    const units = sequenceUnitsByImpact(
      [input("WRITING", "CC", 7.0), input("SPEAKING", "PR", 5.0), input("WRITING", "LR", 6.5)],
      7.5,
      6,
    );
    expect(units[0].criterion).toBe("PR");
    expect(units[0].position).toBe(0);
  });

  it("boosts criteria with worsening ledger errors above an equal-gap peer", () => {
    const units = sequenceUnitsByImpact(
      [input("WRITING", "LR", 6.0), input("WRITING", "GRA", 6.0, 0, 2)],
      7.0,
      6,
    );
    expect(units[0].criterion).toBe("GRA");
  });

  it("weights TR above an equal-gap criterion because Task 2 counts double", () => {
    const units = sequenceUnitsByImpact(
      [input("WRITING", "CC", 6.0), input("WRITING", "TR", 6.0)],
      7.0,
      6,
    );
    expect(units[0].criterion).toBe("TR");
  });

  it("drops criteria already at or above the learner's target", () => {
    const units = sequenceUnitsByImpact(
      [input("WRITING", "CC", 7.5), input("WRITING", "GRA", 6.0)],
      7.0,
      6,
    );
    expect(units).toHaveLength(1);
    expect(units[0].criterion).toBe("GRA");
  });

  it("respects maxUnits", () => {
    const units = sequenceUnitsByImpact(
      [
        input("WRITING", "TR", 5.0),
        input("WRITING", "CC", 5.5),
        input("WRITING", "LR", 5.5),
        input("WRITING", "GRA", 5.0),
        input("SPEAKING", "FC", 5.5),
        input("SPEAKING", "PR", 4.5),
      ],
      7.0,
      3,
    );
    expect(units).toHaveLength(3);
    expect(units.map((u) => u.position)).toEqual([0, 1, 2]);
  });
});

describe("computeWeeksToExam / planLengthForExam", () => {
  const now = new Date("2026-07-21T00:00:00Z");

  it("computes ceiled weeks", () => {
    expect(computeWeeksToExam(new Date("2026-08-04T00:00:00Z"), now)).toBe(2);
    expect(computeWeeksToExam(new Date("2026-08-05T00:00:00Z"), now)).toBe(3);
  });

  it("returns null with no exam date and 0 for a past date", () => {
    expect(computeWeeksToExam(null, now)).toBeNull();
    expect(computeWeeksToExam(new Date("2026-07-01T00:00:00Z"), now)).toBe(0);
  });

  it("paces plan length by runway, clamped", () => {
    expect(planLengthForExam(null)).toBe(6);
    expect(planLengthForExam(3)).toBe(3);
    expect(planLengthForExam(1)).toBe(2);
    expect(planLengthForExam(20)).toBe(8);
  });
});

describe("evaluateUnitProgress", () => {
  const unit = { baselineBand: 6.0, targetBand: 6.5 };

  it("masters when the estimate reaches the target", () => {
    expect(evaluateUnitProgress(unit, 6.5, 1)).toBe("MASTERED");
    expect(evaluateUnitProgress(unit, 7.0, 0)).toBe("MASTERED");
  });

  it("intervenes on a plateau: 3+ sessions with no movement", () => {
    expect(evaluateUnitProgress(unit, 6.0, 3)).toBe("INTERVENED");
    expect(evaluateUnitProgress(unit, 5.8, 4)).toBe("INTERVENED");
  });

  it("keeps going when there is movement, even without mastery", () => {
    expect(evaluateUnitProgress(unit, 6.2, 3)).toBe("KEEP");
  });

  it("keeps going when too few sessions to judge a plateau", () => {
    expect(evaluateUnitProgress(unit, 6.0, 2)).toBe("KEEP");
  });
});
