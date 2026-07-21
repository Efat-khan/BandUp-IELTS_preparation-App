import { prisma } from "@/lib/db";
import { analyzeWithSchema } from "@/lib/gemini/client";
import {
  ErrorCategorizationLLMSchema,
  ProfileNarrativeLLMSchema,
  SessionSummaryLLMSchema,
  type CategorizedError,
  type ProfileNarrativeLLMOutput,
  type SessionSummaryLLMOutput,
} from "@/lib/gemini/schemas/teacher";
import {
  buildErrorCategorizerSystemPrompt,
  buildErrorCategorizerUserPrompt,
  buildProfileNarrativeSystemPrompt,
  buildProfileNarrativeUserPrompt,
  buildSessionSummarizerSystemPrompt,
  buildSessionSummarizerUserPrompt,
} from "@/lib/prompts/tutor";
import { computeRecencyEstimates } from "./criterionEstimates";
import { appendToWindow, computeErrorTrend } from "./errorTrend";
import { buildSessionFacts } from "./sessionFacts";

/**
 * Post-session pipeline (teacher spec step 2): after every scored
 * evaluation, (a) summarizer → session_summaries, (b) error categorizer →
 * error_ledger upsert with code-computed trend, (c) per-criterion
 * estimates + profile narrative recompute.
 *
 * The LLM glue lives in runPostSessionPipeline(); each DB-writing core
 * below takes the LLM output as an argument, so the pipeline is fully
 * exercisable (and demoable) without a Gemini key.
 */

export async function writeSessionSummary(
  userId: string,
  submissionId: string,
  module: "WRITING" | "SPEAKING",
  llm: SessionSummaryLLMOutput,
): Promise<string> {
  const summary = await prisma.sessionSummary.upsert({
    where: { submissionId },
    create: {
      userId,
      submissionId,
      module,
      summary: llm.summary,
      highlights: { wins: llm.wins, struggles: llm.struggles, next_focus: llm.next_focus },
    },
    update: {
      summary: llm.summary,
      highlights: { wins: llm.wins, struggles: llm.struggles, next_focus: llm.next_focus },
    },
  });
  return summary.id;
}

/**
 * Upserts this session's error families and re-windows EVERY ledger entry
 * of the module — families not seen this session get a 0 appended, so an
 * error that stops appearing genuinely trends IMPROVING.
 */
export async function applyErrorCategorization(
  userId: string,
  module: "WRITING" | "SPEAKING",
  sessionErrors: CategorizedError[],
): Promise<void> {
  const now = new Date();
  const countByKey = new Map(sessionErrors.map((e) => [e.error_key, e]));

  const existing = await prisma.errorLedgerEntry.findMany({ where: { userId, module } });
  const existingByKey = new Map(existing.map((e) => [e.errorKey, e]));

  for (const entry of existing) {
    const seen = countByKey.get(entry.errorKey);
    const window = appendToWindow((entry.recentCounts as number[] | null) ?? [], seen?.count ?? 0);
    await prisma.errorLedgerEntry.update({
      where: { id: entry.id },
      data: {
        recentCounts: window,
        trend: computeErrorTrend(window),
        ...(seen
          ? {
              occurrenceCount: entry.occurrenceCount + seen.count,
              lastSeenAt: now,
              example: seen.example,
              label: seen.label,
            }
          : {}),
      },
    });
  }

  for (const error of sessionErrors) {
    if (existingByKey.has(error.error_key)) continue;
    const window = [error.count];
    await prisma.errorLedgerEntry.create({
      data: {
        userId,
        module,
        criterion: error.criterion,
        errorKey: error.error_key,
        label: error.label,
        example: error.example,
        occurrenceCount: error.count,
        recentCounts: window,
        trend: computeErrorTrend(window),
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
  }
}

/** Recomputes per-criterion estimates from canonical scores and stores them on the profile. */
export async function updateCriterionEstimates(userId: string): Promise<Record<string, number>> {
  const scores = await prisma.score.findMany({
    where: { pass: 0, submission: { userId } },
    select: {
      score: true,
      criterion: true,
      createdAt: true,
      submission: { select: { module: true } },
    },
  });

  const estimates = computeRecencyEstimates(
    scores.map((s) => ({
      module: s.submission.module,
      criterion: s.criterion,
      score: Number(s.score),
      createdAt: s.createdAt,
    })),
  );

  await prisma.learnerProfile.upsert({
    where: { userId },
    create: { userId, criterionEstimates: estimates },
    update: { criterionEstimates: estimates },
  });
  return estimates;
}

export async function writeProfileNarrative(
  userId: string,
  llm: ProfileNarrativeLLMOutput,
): Promise<void> {
  await prisma.learnerProfile.upsert({
    where: { userId },
    create: { userId, narrative: llm.narrative },
    update: { narrative: llm.narrative },
  });
}

export function formatEstimateLines(estimates: Record<string, number>): string[] {
  return Object.entries(estimates)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value.toFixed(1)}`);
}

export async function loadLedgerLines(userId: string): Promise<string[]> {
  const entries = await prisma.errorLedgerEntry.findMany({
    where: { userId },
    orderBy: [{ trend: "asc" }, { occurrenceCount: "desc" }],
  });
  return entries.map(
    (e) => `${e.label} (${e.errorKey}) — ${e.criterion} — ${e.occurrenceCount}x — ${e.trend.toLowerCase()}`,
  );
}

/**
 * The full pipeline with real Gemini calls. Failures here must never break
 * the scoring path — callers wrap this in try/catch and treat teacher-layer
 * errors as non-fatal.
 */
/** Non-fatal wrapper for scoring routes — the teacher layer must never break the scoring path. */
export async function runPostSessionPipelineSafe(submissionId: string): Promise<void> {
  try {
    await runPostSessionPipeline(submissionId);
  } catch (error) {
    console.error(
      `Teacher post-session pipeline failed for submission ${submissionId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

export async function runPostSessionPipeline(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { userId: true, module: true, user: { select: { targetBand: true } } },
  });
  const facts = await buildSessionFacts(submissionId);

  const summaryOut = await analyzeWithSchema(
    buildSessionSummarizerSystemPrompt(),
    buildSessionSummarizerUserPrompt(facts),
    SessionSummaryLLMSchema,
  );
  await writeSessionSummary(submission.userId, submissionId, submission.module, summaryOut);

  const categorization = await analyzeWithSchema(
    buildErrorCategorizerSystemPrompt(),
    buildErrorCategorizerUserPrompt(facts),
    ErrorCategorizationLLMSchema,
  );
  await applyErrorCategorization(submission.userId, submission.module, categorization.errors);

  const estimates = await updateCriterionEstimates(submission.userId);

  const profile = await prisma.learnerProfile.findUnique({ where: { userId: submission.userId } });
  const narrativeOut = await analyzeWithSchema(
    buildProfileNarrativeSystemPrompt(),
    buildProfileNarrativeUserPrompt({
      previousNarrative: profile?.narrative ?? null,
      criterionEstimateLines: formatEstimateLines(estimates),
      ledgerLines: await loadLedgerLines(submission.userId),
      latestSummary: summaryOut.summary,
      targetBand:
        profile?.targetBand !== null && profile?.targetBand !== undefined
          ? Number(profile.targetBand).toFixed(1)
          : submission.user.targetBand !== null
            ? Number(submission.user.targetBand).toFixed(1)
            : null,
      examDate: profile?.examDate ? profile.examDate.toISOString().slice(0, 10) : null,
    }),
    ProfileNarrativeLLMSchema,
  );
  await writeProfileNarrative(submission.userId, narrativeOut);

  // Plan status + mini-lessons depend on a study plan already existing —
  // absent for a learner who hasn't finished the diagnostic yet.
  const hasPlan = await prisma.studyPlan.findUnique({ where: { userId: submission.userId } });
  if (hasPlan) {
    const { refreshUnitStatuses } = await import("./studyPlan");
    const { maybeGenerateMiniLessons } = await import("./miniLessons");
    await refreshUnitStatuses(submission.userId);
    await maybeGenerateMiniLessons(submission.userId);
  }
}
