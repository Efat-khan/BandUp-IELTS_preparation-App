import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { generateAndPersistQuestion } from "@/lib/questions/generateQuestion";
import { generateSpeakingDrillQuestion } from "@/lib/speaking/generateSpeakingSession";

export const dynamic = "force-dynamic";

interface DiagnosticStartRequestBody {
  userId?: string;
}

/**
 * Diagnostic first session (teacher spec step 3): one Task 2 essay + one
 * Speaking long turn (Part 2 cue card). Reuses the exact same generation
 * and scoring paths as any other practice attempt — the diagnostic isn't a
 * separate scorer, only a labeled first session the teacher layer reads
 * back afterward.
 */
export async function POST(request: NextRequest) {
  try {
    let body: DiagnosticStartRequestBody = {};
    try {
      body = (await request.json()) as DiagnosticStartRequestBody;
    } catch {
      // empty body is fine
    }
    const userId = await resolveUserId(body.userId);

    const [writing, speaking] = await Promise.all([
      generateAndPersistQuestion({ taskType: "task2", userId }),
      generateSpeakingDrillQuestion(userId, "part2"),
    ]);

    return Response.json({
      writing: { id: writing.questionId, ...writing.contract },
      speaking: { id: speaking.questionId, ...speaking.contract },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
