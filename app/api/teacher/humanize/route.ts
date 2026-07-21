import type { NextRequest } from "next/server";
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
    const feedback = await humanizeFeedback(body.submissionId);
    return Response.json(feedback);
  } catch (error) {
    // The teacher layer must never block results: the client falls back to
    // the standard scorer presentation on any failure here.
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
