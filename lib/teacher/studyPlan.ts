import { prisma } from "@/lib/db";
import type { Criterion } from "@/lib/generated/prisma/client";
import { teachWithSchema } from "@/lib/gemini/client";
import { StudyPlanCopyLLMSchema, type StudyPlanCopyLLMOutput } from "@/lib/gemini/schemas/teacher";
import { buildStudyPlanCopyUserPrompt, TUTOR_SYSTEM_PROMPT } from "@/lib/prompts/tutor";
import { loadTeacherContext } from "./orchestrator";
import {
  computeWeeksToExam,
  evaluateUnitProgress,
  planLengthForExam,
  sequenceUnitsByImpact,
  type CriterionImpactInput,
  type SequencedUnit,
} from "./studyPlanEngine";

/**
 * Study-plan persistence + refresh. Sequencing decisions are pure
 * (studyPlanEngine.ts); the tutor LLM only writes copy. writeStudyPlan()
 * takes the LLM copy as an argument so the flow runs without a Gemini key.
 */

export async function buildImpactInputs(userId: string): Promise<CriterionImpactInput[]> {
  const profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  const estimates = (profile?.criterionEstimates as Record<string, number> | null) ?? {};

  const ledger = await prisma.errorLedgerEntry.findMany({ where: { userId } });
  const ledgerCounts = new Map<string, { persistent: number; worsening: number }>();
  for (const entry of ledger) {
    const key = `${entry.module}:${entry.criterion}`;
    const bucket = ledgerCounts.get(key) ?? { persistent: 0, worsening: 0 };
    if (entry.trend === "PERSISTENT") bucket.persistent += 1;
    if (entry.trend === "WORSENING") bucket.worsening += 1;
    ledgerCounts.set(key, bucket);
  }

  return Object.entries(estimates).map(([key, estimate]) => {
    const [module, criterion] = key.split(":") as ["WRITING" | "SPEAKING", string];
    const counts = ledgerCounts.get(key) ?? { persistent: 0, worsening: 0 };
    return {
      module,
      criterion,
      estimate,
      persistentErrorFamilies: counts.persistent,
      worseningErrorFamilies: counts.worsening,
    };
  });
}

/** Replaces the user's plan with the sequenced units + tutor copy. MASTERED status survives for unchanged module:criterion units. */
export async function writeStudyPlan(
  userId: string,
  units: SequencedUnit[],
  copy: StudyPlanCopyLLMOutput,
  examDate: Date | null,
): Promise<string> {
  const copyByPosition = new Map(copy.units.map((u) => [u.position, u]));

  const existingPlan = await prisma.studyPlan.findUnique({
    where: { userId },
    include: { units: true },
  });
  const masteredKeys = new Set(
    (existingPlan?.units ?? [])
      .filter((u) => u.status === "MASTERED")
      .map((u) => `${u.module}:${u.criterion}`),
  );

  const plan = await prisma.studyPlan.upsert({
    where: { userId },
    create: { userId, introduction: copy.introduction, examDate },
    update: { introduction: copy.introduction, examDate },
  });
  await prisma.studyPlanUnit.deleteMany({ where: { planId: plan.id } });

  let activeAssigned = false;
  for (const unit of units) {
    const unitCopy = copyByPosition.get(unit.position);
    const isMastered = masteredKeys.has(`${unit.module}:${unit.criterion}`);
    const status = isMastered ? "MASTERED" : !activeAssigned ? "ACTIVE" : "PENDING";
    if (status === "ACTIVE") activeAssigned = true;
    await prisma.studyPlanUnit.create({
      data: {
        planId: plan.id,
        position: unit.position,
        module: unit.module,
        criterion: unit.criterion as Criterion,
        title: unitCopy?.title ?? `${unit.module} ${unit.criterion}`,
        rationale: unitCopy?.rationale ?? "",
        actions: unitCopy?.actions ?? [],
        status,
        baselineBand: unit.baselineBand,
        targetBand: unit.targetBand,
      },
    });
  }
  return plan.id;
}

/** Full generation with the real tutor LLM writing the copy. */
export async function generateStudyPlan(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  const examDate = profile?.examDate ?? null;
  const targetBand =
    profile?.targetBand !== null && profile?.targetBand !== undefined
      ? Number(profile.targetBand)
      : user.targetBand !== null
        ? Number(user.targetBand)
        : null;

  const weeksToExam = computeWeeksToExam(examDate, new Date());
  const inputs = await buildImpactInputs(userId);
  const units = sequenceUnitsByImpact(inputs, targetBand, planLengthForExam(weeksToExam));
  if (units.length === 0) {
    throw new Error("No scored history yet — complete the diagnostic before generating a plan.");
  }

  const ctx = await loadTeacherContext(userId);
  const copy = await teachWithSchema(
    TUTOR_SYSTEM_PROMPT,
    buildStudyPlanCopyUserPrompt(
      ctx,
      units.map((u) => ({
        position: u.position,
        module: u.module,
        criterion: u.criterion,
        baselineBand: u.baselineBand,
        targetBand: u.targetBand,
      })),
      weeksToExam,
    ),
    StudyPlanCopyLLMSchema,
  );

  return writeStudyPlan(userId, units, copy, examDate);
}

export interface IntervenedUnit {
  unitId: string;
  module: "WRITING" | "SPEAKING";
  criterion: string;
}

/**
 * Mastery→advance and plateau→intervene transitions after a session.
 * Returns newly intervened units so the caller can trigger mini-lessons.
 */
export async function refreshUnitStatuses(userId: string): Promise<IntervenedUnit[]> {
  const plan = await prisma.studyPlan.findUnique({ where: { userId }, include: { units: true } });
  if (!plan) return [];

  const profile = await prisma.learnerProfile.findUnique({ where: { userId } });
  const estimates = (profile?.criterionEstimates as Record<string, number> | null) ?? {};
  const intervened: IntervenedUnit[] = [];

  for (const unit of plan.units) {
    if (unit.status === "MASTERED") continue;
    const estimate = estimates[`${unit.module}:${unit.criterion}`];
    if (estimate === undefined || unit.baselineBand === null || unit.targetBand === null) continue;

    const scoredSessions = await prisma.score.count({
      where: {
        pass: 0,
        criterion: unit.criterion as never,
        createdAt: { gt: unit.createdAt },
        submission: { userId, module: unit.module },
      },
    });

    const decision = evaluateUnitProgress(
      { baselineBand: Number(unit.baselineBand), targetBand: Number(unit.targetBand) },
      estimate,
      scoredSessions,
    );

    if (decision === "MASTERED") {
      await prisma.studyPlanUnit.update({ where: { id: unit.id }, data: { status: "MASTERED" } });
    } else if (decision === "INTERVENED" && unit.status !== "INTERVENED") {
      await prisma.studyPlanUnit.update({ where: { id: unit.id }, data: { status: "INTERVENED" } });
      intervened.push({ unitId: unit.id, module: unit.module, criterion: unit.criterion });
    }
  }

  // Exactly one ACTIVE unit among the not-yet-mastered (lowest position wins).
  const refreshed = await prisma.studyPlanUnit.findMany({
    where: { planId: plan.id },
    orderBy: { position: "asc" },
  });
  const firstOpen = refreshed.find((u) => u.status !== "MASTERED" && u.status !== "INTERVENED");
  for (const unit of refreshed) {
    if (unit.status === "MASTERED" || unit.status === "INTERVENED") continue;
    const shouldBeActive = unit.id === firstOpen?.id;
    const desired = shouldBeActive ? "ACTIVE" : "PENDING";
    if (unit.status !== desired) {
      await prisma.studyPlanUnit.update({ where: { id: unit.id }, data: { status: desired } });
    }
  }

  return intervened;
}
