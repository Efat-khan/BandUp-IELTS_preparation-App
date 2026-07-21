import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/demoUser";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request.nextUrl.searchParams.get("userId"));
    const lessons = await prisma.miniLesson.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { ledgerEntry: true, planUnit: true },
    });
    return Response.json({
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        content: l.content,
        createdAt: l.createdAt.toISOString(),
        errorLabel: l.ledgerEntry.label,
        criterion: l.ledgerEntry.criterion,
        planUnitTitle: l.planUnit?.title ?? null,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
