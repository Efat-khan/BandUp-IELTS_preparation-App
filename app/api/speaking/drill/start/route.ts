import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { errorResponse } from "@/lib/http/errorResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import {
  generateSpeakingDrillQuestion,
  type SpeakingDrillPart,
} from "@/lib/speaking/generateSpeakingSession";

export const dynamic = "force-dynamic";

interface StartDrillRequestBody {
  userId?: string;
  part?: SpeakingDrillPart;
  difficulty?: "easy" | "medium" | "hard";
}

async function parseBody(request: NextRequest): Promise<StartDrillRequestBody> {
  try {
    return (await request.json()) as StartDrillRequestBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(RATE_LIMITS.generation, request);
    if (limited) return limited;
    const body = await parseBody(request);
    const part = body.part ?? "part2";
    if (part !== "part1" && part !== "part2") {
      return Response.json({ error: "part must be 'part1' or 'part2'" }, { status: 400 });
    }

    const userId = await resolveUserId(body.userId);
    const result = await generateSpeakingDrillQuestion(userId, part, body.difficulty);

    return Response.json({ id: result.questionId, ...result.contract });
  } catch (error) {
    return errorResponse(error);
  }
}
