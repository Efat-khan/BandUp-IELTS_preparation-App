import { prisma } from "@/lib/db";
import type { SessionFacts } from "@/lib/prompts/tutor";

const TASK_LABELS: Record<string, string> = {
  WRITING_TASK1_ACADEMIC: "Writing Task 1 (Academic)",
  WRITING_TASK1_GENERAL: "Writing Task 1 (General Training letter)",
  WRITING_TASK2: "Writing Task 2 essay",
  SPEAKING_PART1: "Speaking Part 1 (interview)",
  SPEAKING_PART2: "Speaking Part 2 (long turn / cue card)",
  SPEAKING_PART3: "Speaking Part 3 (discussion)",
};

const ANSWER_EXCERPT_CHARS = 1500;

interface ScoreEvidence {
  evidence?: string[];
  why?: string;
}

interface InlineError {
  quote: string;
  issue: string;
  correction: string;
  category: string;
}

/**
 * Loads everything the teacher layer is allowed to know about one scored
 * submission — the question, the canonical (pass 0) bands, the evidence
 * quotes, and the learner's own answer — as a prompt-ready SessionFacts.
 * Bands come straight from the DB; this is the ground truth every
 * downstream assert compares against.
 */
export async function buildSessionFacts(submissionId: string): Promise<SessionFacts> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      question: true,
      scores: { where: { pass: 0 }, orderBy: { criterion: "asc" } },
    },
  });

  const criterionLines = submission.scores.map(
    (s) => `${s.criterion}: ${Number(s.score).toFixed(1)}`,
  );

  const evidenceLines = submission.scores.map((s) => {
    const ev = (s.evidence as ScoreEvidence | null) ?? {};
    const quotes = (ev.evidence ?? []).map((q) => `"${q}"`).join(" | ");
    return `${s.criterion} — ${quotes}${ev.why ? ` (${ev.why})` : ""}`;
  });

  const inlineErrors = (submission.inlineErrors as InlineError[] | null) ?? [];
  const inlineErrorLines = inlineErrors.map(
    (e) => `"${e.quote}" → "${e.correction}" (${e.issue}; ${e.category})`,
  );

  const answerSource = submission.answerText ?? submission.transcript ?? "";
  const answerExcerpt =
    answerSource.length > ANSWER_EXCERPT_CHARS
      ? `${answerSource.slice(0, ANSWER_EXCERPT_CHARS)}…`
      : answerSource;

  return {
    module: submission.module,
    taskLabel: TASK_LABELS[submission.question.taskType] ?? submission.question.taskType,
    questionPrompt: submission.question.prompt,
    overallBand:
      submission.overallBand !== null ? Number(submission.overallBand).toFixed(1) : "(not scored)",
    criterionLines,
    evidenceLines,
    inlineErrorLines,
    answerExcerpt,
  };
}

/** The DB bands for one submission, used by the humanizer's invariance assert. */
export interface DbBands {
  overallBand: number | null;
  criterionBands: Record<string, number>;
}

export async function loadDbBands(submissionId: string): Promise<DbBands> {
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    select: {
      overallBand: true,
      scores: { where: { pass: 0 }, select: { criterion: true, score: true } },
    },
  });
  const criterionBands: Record<string, number> = {};
  for (const s of submission.scores) criterionBands[s.criterion] = Number(s.score);
  return {
    overallBand: submission.overallBand !== null ? Number(submission.overallBand) : null,
    criterionBands,
  };
}
