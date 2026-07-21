import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http/errorResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import { humanizeFeedback } from "@/lib/teacher/orchestrator";

export const dynamic = "force-dynamic";

interface HumanizeRequestBody {
  submissionId?: string;
}

export async function POST(request: NextRequest) {
  let body: HumanizeRequestBody;
  try {
    body = (await request.json()) as HumanizeRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.submissionId) {
    return Response.json({ error: "submissionId is required" }, { status: 400 });
  }

  try {
    const limited = enforceRateLimit(RATE_LIMITS.chat, request);
    if (limited) return limited;
    const feedback = await humanizeFeedback(body.submissionId);
    return Response.json(feedback);
  } catch (error) {
    // The teacher layer must never block results: the client falls back to
    // the standard scorer presentation on any failure here.
    return errorResponse(error);
  }
}
