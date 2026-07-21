import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/demoUser";
import { generateStudyPlan } from "@/lib/teacher/studyPlan";

export const dynamic = "force-dynamic";

async function loadPlan(userId: string) {
  const plan = await prisma.studyPlan.findUnique({
    where: { userId },
    include: { units: { orderBy: { position: "asc" }, include: { miniLessons: true } } },
  });
  if (!plan) return null;
  return {
    id: plan.id,
    introduction: plan.introduction,
    examDate: plan.examDate ? plan.examDate.toISOString().slice(0, 10) : null,
    updatedAt: plan.updatedAt.toISOString(),
    units: plan.units.map((u) => ({
      id: u.id,
      position: u.position,
      module: u.module,
      criterion: u.criterion,
      title: u.title,
      rationale: u.rationale,
      actions: u.actions,
      status: u.status,
      baselineBand: u.baselineBand !== null ? Number(u.baselineBand) : null,
      targetBand: u.targetBand !== null ? Number(u.targetBand) : null,
      miniLessons: u.miniLessons.map((l) => ({ id: l.id, title: l.title })),
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request.nextUrl.searchParams.get("userId"));
    const plan = await loadPlan(userId);
    if (!plan) {
      return Response.json(
        { error: "No study plan yet — complete the diagnostic first." },
        { status: 404 },
      );
    }
    return Response.json(plan);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

/** Regenerates the plan from the current estimates/ledger (tutor writes fresh copy). */
export async function POST(request: NextRequest) {
  try {
    let body: { userId?: string } = {};
    try {
      body = (await request.json()) as { userId?: string };
    } catch {
      // empty body is fine
    }
    const userId = await resolveUserId(body.userId);
    await generateStudyPlan(userId);
    const plan = await loadPlan(userId);
    return Response.json(plan);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
