import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/demoUser";
import { teachFreeText } from "@/lib/gemini/client";
import { errorResponse } from "@/lib/http/errorResponse";
import { buildDiagnosticDebriefUserPrompt, TUTOR_SYSTEM_PROMPT } from "@/lib/prompts/tutor";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import { generateStudyPlan } from "@/lib/teacher/studyPlan";
import { loadTeacherContext } from "@/lib/teacher/orchestrator";
import { buildSessionFacts } from "@/lib/teacher/sessionFacts";

export const dynamic = "force-dynamic";

interface DiagnosticCompleteRequestBody {
  userId?: string;
  writingSubmissionId?: string;
  speakingSubmissionId?: string;
}

/**
 * Marks the diagnostic complete, writes the tutor's welcome debrief (both
 * bands are FINAL — restated, never altered), and generates the learner's
 * first study plan from the profile/ledger the two diagnostic sessions'
 * post-session pipelines already populated.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(RATE_LIMITS.generation, request);
    if (limited) return limited;
    let body: DiagnosticCompleteRequestBody;
    try {
      body = (await request.json()) as DiagnosticCompleteRequestBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.writingSubmissionId || !body.speakingSubmissionId) {
      return Response.json(
        { error: "writingSubmissionId and speakingSubmissionId are required" },
        { status: 400 },
      );
    }

    const userId = await resolveUserId(body.userId);

    await prisma.learnerProfile.upsert({
      where: { userId },
      create: { userId, diagnosticCompletedAt: new Date() },
      update: { diagnosticCompletedAt: new Date() },
    });

    const [ctx, writingFacts, speakingFacts] = await Promise.all([
      loadTeacherContext(userId),
      buildSessionFacts(body.writingSubmissionId),
      buildSessionFacts(body.speakingSubmissionId),
    ]);

    // The debrief text and the study plan don't depend on each other's
    // output, so the two Flash calls run in parallel (cost/latency control).
    const [debrief, planId] = await Promise.all([
      teachFreeText(TUTOR_SYSTEM_PROMPT, buildDiagnosticDebriefUserPrompt(ctx, writingFacts, speakingFacts)),
      generateStudyPlan(userId),
    ]);
    await prisma.coachingMessage.create({ data: { userId, role: "TUTOR", content: debrief } });

    return Response.json({ debrief, planId });
  } catch (error) {
    return errorResponse(error);
  }
}
