import { prisma } from "@/lib/db";
import { teachFreeText, teachWithSchema } from "@/lib/gemini/client";
import {
  HumanizedFeedbackLLMSchema,
  type HumanizedFeedbackLLMOutput,
} from "@/lib/gemini/schemas/teacher";
import {
  buildCoachUserPrompt,
  buildFeedbackHumanizerUserPrompt,
  TUTOR_SYSTEM_PROMPT,
  type TeacherContextBlock,
} from "@/lib/prompts/tutor";
import { formatEstimateLines, loadLedgerLines } from "./postSession";
import { buildSessionFacts, loadDbBands, type DbBands } from "./sessionFacts";

/**
 * Teacher Orchestrator — the single gateway for every learner-facing
 * teacher message. Loads profile + ledger + plan + last summary before ANY
 * message is written, and enforces the two-brains rule: the warm teacher
 * PRESENTS bands, the cold scorer OWNS them. Every band the humanizer
 * echoes is asserted (and then re-stamped) against the DB.
 */

export async function loadTeacherContext(userId: string): Promise<TeacherContextBlock> {
  const [user, profile, ledgerLines, lastSummary, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.learnerProfile.findUnique({ where: { userId } }),
    loadLedgerLines(userId),
    prisma.sessionSummary.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.studyPlan.findUnique({
      where: { userId },
      include: { units: { orderBy: { position: "asc" } } },
    }),
  ]);

  const estimates = (profile?.criterionEstimates as Record<string, number> | null) ?? {};
  const activeUnit = plan?.units.find((u) => u.status === "ACTIVE" || u.status === "INTERVENED");

  const targetBand =
    profile?.targetBand !== null && profile?.targetBand !== undefined
      ? Number(profile.targetBand).toFixed(1)
      : user.targetBand !== null
        ? Number(user.targetBand).toFixed(1)
        : null;

  return {
    learnerName: user.name,
    narrative: profile?.narrative ?? null,
    criterionEstimateLines: formatEstimateLines(estimates),
    ledgerLines,
    activePlanUnitLine: activeUnit
      ? `"${activeUnit.title}" (${activeUnit.module} ${activeUnit.criterion}, baseline ${activeUnit.baselineBand !== null ? Number(activeUnit.baselineBand).toFixed(1) : "?"} → target ${activeUnit.targetBand !== null ? Number(activeUnit.targetBand).toFixed(1) : "?"}${activeUnit.status === "INTERVENED" ? "; plateaued — approach changed" : ""})`
      : null,
    lastSummary: lastSummary?.summary ?? null,
    targetBand,
    examDate: profile?.examDate ? profile.examDate.toISOString().slice(0, 10) : null,
  };
}

export class BandIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BandIntegrityError";
  }
}

const BAND_EPSILON = 1e-9;

/**
 * The two-brains assert: every band echoed by the humanizer must equal the
 * DB value exactly — a single altered digit throws. Pure, so the invariant
 * is directly unit-testable.
 */
export function assertBandsUnchanged(llm: HumanizedFeedbackLLMOutput, db: DbBands): void {
  if (db.overallBand === null) {
    throw new BandIntegrityError("Submission has no overall band to present");
  }
  if (Math.abs(llm.overall_band - db.overallBand) > BAND_EPSILON) {
    throw new BandIntegrityError(
      `Humanizer altered the overall band: DB says ${db.overallBand}, output says ${llm.overall_band}`,
    );
  }

  const dbCriteria = Object.keys(db.criterionBands);
  const outputByCriterion = new Map(llm.criterion_comments.map((c) => [c.criterion, c.band]));

  for (const criterion of dbCriteria) {
    const echoed = outputByCriterion.get(criterion as never);
    if (echoed === undefined) {
      throw new BandIntegrityError(`Humanizer dropped criterion ${criterion}`);
    }
    if (Math.abs(echoed - db.criterionBands[criterion]) > BAND_EPSILON) {
      throw new BandIntegrityError(
        `Humanizer altered ${criterion}: DB says ${db.criterionBands[criterion]}, output says ${echoed}`,
      );
    }
  }
  for (const criterion of outputByCriterion.keys()) {
    if (!(criterion in db.criterionBands)) {
      throw new BandIntegrityError(`Humanizer invented criterion ${criterion}`);
    }
  }
}

export interface HumanizedFeedback {
  greeting: string;
  overallBand: number;
  overallComment: string;
  criterionComments: Array<{ criterion: string; band: number; comment: string }>;
  priorityAction: string;
  encouragement: string;
}

/**
 * Re-stamps every band from the DB after the assert passes — even a passed
 * assert never lets an LLM value through; presentation always carries the
 * scorer's own numbers.
 */
export function toHumanizedFeedback(
  llm: HumanizedFeedbackLLMOutput,
  db: DbBands,
): HumanizedFeedback {
  assertBandsUnchanged(llm, db);
  return {
    greeting: llm.greeting,
    overallBand: db.overallBand as number,
    overallComment: llm.overall_comment,
    criterionComments: llm.criterion_comments.map((c) => ({
      criterion: c.criterion,
      band: db.criterionBands[c.criterion],
      comment: c.comment,
    })),
    priorityAction: llm.priority_action,
    encouragement: llm.encouragement,
  };
}

const HUMANIZER_MAX_ATTEMPTS = 2;

/** Entry point 1: rewrite the scorer's result in the tutor voice, bands untouched. */
export async function humanizeFeedback(submissionId: string): Promise<HumanizedFeedback> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { userId: true },
  });
  const [ctx, facts, dbBands] = await Promise.all([
    loadTeacherContext(submission.userId),
    buildSessionFacts(submissionId),
    loadDbBands(submissionId),
  ]);

  let lastError: unknown;
  for (let attempt = 0; attempt < HUMANIZER_MAX_ATTEMPTS; attempt++) {
    const llm = await teachWithSchema(
      TUTOR_SYSTEM_PROMPT,
      buildFeedbackHumanizerUserPrompt(ctx, facts),
      HumanizedFeedbackLLMSchema,
    );
    try {
      return toHumanizedFeedback(llm, dbBands);
    } catch (error) {
      if (!(error instanceof BandIntegrityError)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

const COACH_HISTORY_LIMIT = 12;

/** Entry point 2: the coaching chat — "ask your tutor why". */
export async function coachReply(
  userId: string,
  submissionId: string | null,
  learnerMessage: string,
): Promise<string> {
  const [ctx, facts, historyRows] = await Promise.all([
    loadTeacherContext(userId),
    submissionId ? buildSessionFacts(submissionId) : Promise.resolve(null),
    prisma.coachingMessage.findMany({
      where: { userId, ...(submissionId ? { submissionId } : {}) },
      orderBy: { createdAt: "desc" },
      take: COACH_HISTORY_LIMIT,
    }),
  ]);
  const history = historyRows
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));

  const reply = await teachFreeText(
    TUTOR_SYSTEM_PROMPT,
    buildCoachUserPrompt(ctx, facts, history, learnerMessage),
  );

  await prisma.coachingMessage.createMany({
    data: [
      { userId, submissionId, role: "LEARNER", content: learnerMessage },
      { userId, submissionId, role: "TUTOR", content: reply },
    ],
  });

  return reply;
}
