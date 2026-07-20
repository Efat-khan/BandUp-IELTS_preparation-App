import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { generateSpeakingSession } from "@/lib/speaking/generateSpeakingSession";

export const dynamic = "force-dynamic";

interface StartRequestBody {
  userId?: string;
  difficulty?: "easy" | "medium" | "hard";
}

async function parseBody(request: NextRequest): Promise<StartRequestBody> {
  try {
    return (await request.json()) as StartRequestBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const userId = await resolveUserId(body.userId);
    const session = await generateSpeakingSession(userId, body.difficulty);
    return Response.json(session);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
