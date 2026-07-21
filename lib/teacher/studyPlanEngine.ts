/**
 * Pure study-plan sequencing/pacing logic — no DB, no LLM. The tutor LLM
 * only writes the COPY for a plan (titles/rationales/actions); which units
 * exist, their order, and their status transitions are decided here.
 */

export interface CriterionImpactInput {
  module: "WRITING" | "SPEAKING";
  criterion: string;
  /** Current recency-weighted band estimate for this criterion. */
  estimate: number;
  persistentErrorFamilies: number;
  worseningErrorFamilies: number;
}

export interface SequencedUnit {
  position: number;
  module: "WRITING" | "SPEAKING";
  criterion: string;
  baselineBand: number;
  targetBand: number;
  impact: number;
}

/** Writing Task 2 is double-weighted in the final Writing band, and TR only exists there — improving TR moves the overall more than any other Writing criterion. */
const CRITERION_LEVERAGE: Record<string, number> = {
  TR: 1.3,
  TA: 1.0,
  CC: 1.0,
  LR: 1.0,
  GRA: 1.0,
  FC: 1.1, // FC failures compound across all three Speaking parts
  PR: 1.0,
};

const PERSISTENT_ERROR_BOOST = 0.25;
const WORSENING_ERROR_BOOST = 0.5;

/** Next half-band at least this far above the baseline. */
export function nextUnitTarget(baseline: number): number {
  return Math.min(9, Math.ceil((baseline + 0.5) * 2) / 2);
}

/**
 * Impact = how far below target the criterion sits (leverage-weighted),
 * boosted where the ledger shows concrete, addressable error families.
 * Ties broken deterministically by module+criterion name.
 */
export function sequenceUnitsByImpact(
  inputs: CriterionImpactInput[],
  learnerTargetBand: number | null,
  maxUnits: number,
): SequencedUnit[] {
  const scored = inputs.map((input) => {
    const target = learnerTargetBand ?? nextUnitTarget(input.estimate);
    const gap = Math.max(0, target - input.estimate);
    const leverage = CRITERION_LEVERAGE[input.criterion] ?? 1.0;
    const impact =
      gap * leverage +
      input.persistentErrorFamilies * PERSISTENT_ERROR_BOOST +
      input.worseningErrorFamilies * WORSENING_ERROR_BOOST;
    return { input, impact };
  });

  return scored
    .filter(({ impact }) => impact > 0)
    .sort(
      (a, b) =>
        b.impact - a.impact ||
        `${a.input.module}:${a.input.criterion}`.localeCompare(`${b.input.module}:${b.input.criterion}`),
    )
    .slice(0, maxUnits)
    .map(({ input, impact }, index) => ({
      position: index,
      module: input.module,
      criterion: input.criterion,
      baselineBand: Math.round(input.estimate * 10) / 10,
      targetBand: nextUnitTarget(input.estimate),
      impact,
    }));
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function computeWeeksToExam(examDate: Date | null, now: Date): number | null {
  if (!examDate) return null;
  const diff = examDate.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_WEEK);
}

const DEFAULT_PLAN_LENGTH = 6;
const MIN_PLAN_LENGTH = 2;
const MAX_PLAN_LENGTH = 8;

/**
 * Exam-date pacing: roughly one unit per remaining week, clamped — a
 * 3-week runway gets a tight 3-unit plan; no exam date gets the default.
 */
export function planLengthForExam(weeksToExam: number | null): number {
  if (weeksToExam === null) return DEFAULT_PLAN_LENGTH;
  return Math.max(MIN_PLAN_LENGTH, Math.min(MAX_PLAN_LENGTH, weeksToExam));
}

export const PLATEAU_SESSIONS = 3;

export type UnitProgressDecision = "MASTERED" | "INTERVENED" | "KEEP";

/**
 * Mastery → advance: estimate has reached the unit's target.
 * Plateau → intervene: ≥ PLATEAU_SESSIONS scored attempts on this
 * criterion since the unit started, with no movement above baseline.
 */
export function evaluateUnitProgress(
  unit: { baselineBand: number; targetBand: number },
  currentEstimate: number,
  scoredSessionsSinceStart: number,
): UnitProgressDecision {
  if (currentEstimate >= unit.targetBand) return "MASTERED";
  if (scoredSessionsSinceStart >= PLATEAU_SESSIONS && currentEstimate <= unit.baselineBand + 0.05) {
    return "INTERVENED";
  }
  return "KEEP";
}
