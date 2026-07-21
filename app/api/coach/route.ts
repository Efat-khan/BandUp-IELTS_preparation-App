import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveUserId } from "@/lib/demoUser";
import { coachReply } from "@/lib/teacher/orchestrator";

export const dynamic = "force-dynamic";

interface CoachRequestBody {
  userId?: string;
  submissionId?: string;
  message?: string;
}

/** "Ask your tutor why" — full-context coaching chat. */
export async function POST(request: NextRequest) {
  let body: CoachRequestBody;
  try {
    body = (await request.json()) as CoachRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.message || body.message.trim().length === 0) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const userId = await resolveUserId(body.userId);
    const reply = await coachReply(userId, body.submissionId ?? null, body.message.trim());
    return Response.json({ reply });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

/** Persisted chat history (optionally scoped to one submission). */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request.nextUrl.searchParams.get("userId"));
    const submissionId = request.nextUrl.searchParams.get("submissionId");
    const messages = await prisma.coachingMessage.findMany({
      where: { userId, ...(submissionId ? { submissionId } : {}) },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    return Response.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
