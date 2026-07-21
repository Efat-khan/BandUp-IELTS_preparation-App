import { prisma } from "@/lib/db";
import { teachWithSchema } from "@/lib/gemini/client";
import { MiniLessonLLMSchema, type MiniLessonLLMOutput } from "@/lib/gemini/schemas/teacher";
import { buildMiniLessonUserPrompt, TUTOR_SYSTEM_PROMPT } from "@/lib/prompts/tutor";
import { loadTeacherContext } from "./orchestrator";

/**
 * Mini-lessons: when an error family stays persistent (or a plan unit
 * plateaus), the tutor writes a targeted micro-lesson built on the
 * learner's own sentences, linked to the current plan unit.
 */

const PERSISTENT_LESSON_THRESHOLD = 3;

/** DB writer split out so the demo/seed path can run without a Gemini key. */
export async function writeMiniLesson(
  userId: string,
  errorLedgerId: string,
  planUnitId: string | null,
  llm: MiniLessonLLMOutput,
): Promise<string> {
  const lesson = await prisma.miniLesson.create({
    data: { userId, errorLedgerId, planUnitId, title: llm.title, content: llm.content },
  });
  return lesson.id;
}

export async function generateMiniLesson(
  userId: string,
  errorLedgerId: string,
  planUnitId: string | null,
): Promise<string> {
  const entry = await prisma.errorLedgerEntry.findUniqueOrThrow({ where: { id: errorLedgerId } });
  const ctx = await loadTeacherContext(userId);
  const llm = await teachWithSchema(
    TUTOR_SYSTEM_PROMPT,
    buildMiniLessonUserPrompt(ctx, {
      label: entry.label,
      errorKey: entry.errorKey,
      criterion: entry.criterion,
      example: entry.example,
      occurrenceCount: entry.occurrenceCount,
    }),
    MiniLessonLLMSchema,
  );
  return writeMiniLesson(userId, errorLedgerId, planUnitId, llm);
}

async function findPlanUnitFor(
  userId: string,
  module: "WRITING" | "SPEAKING",
  criterion: string,
): Promise<string | null> {
  const plan = await prisma.studyPlan.findUnique({ where: { userId }, include: { units: true } });
  return plan?.units.find((u) => u.module === module && u.criterion === criterion)?.id ?? null;
}

/**
 * Trigger pass, run after each session's ledger update: any persistent/
 * worsening family with ≥3 total occurrences and no lesson yet gets one.
 */
export async function maybeGenerateMiniLessons(userId: string): Promise<string[]> {
  const generated: string[] = [];

  const candidates = await prisma.errorLedgerEntry.findMany({
    where: {
      userId,
      trend: { in: ["PERSISTENT", "WORSENING"] },
      occurrenceCount: { gte: PERSISTENT_LESSON_THRESHOLD },
    },
    orderBy: { occurrenceCount: "desc" },
  });

  for (const entry of candidates) {
    const existing = await prisma.miniLesson.findFirst({ where: { errorLedgerId: entry.id } });
    if (existing) continue;

    const planUnitId = await findPlanUnitFor(userId, entry.module, entry.criterion);
    generated.push(await generateMiniLesson(userId, entry.id, planUnitId));
  }

  return generated;
}
