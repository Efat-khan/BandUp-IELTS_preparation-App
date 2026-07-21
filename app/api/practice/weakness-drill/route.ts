import type { NextRequest } from "next/server";
import { resolveUserId } from "@/lib/demoUser";
import { findWeakestCriterion } from "@/lib/progress/weaknessDrill";
import { generateAndPersistQuestion } from "@/lib/questions/generateQuestion";
import { generateSpeakingDrillQuestion } from "@/lib/speaking/generateSpeakingSession";

export const dynamic = "force-dynamic";

interface WeaknessDrillRequestBody {
  userId?: string;
}

async function parseBody(request: NextRequest): Promise<WeaknessDrillRequestBody> {
  try {
    return (await request.json()) as WeaknessDrillRequestBody;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const userId = await resolveUserId(body.userId);

    const weakest = await findWeakestCriterion(userId);
    if (!weakest) {
      return Response.json(
        {
          error:
            "Not enough scored attempts yet to identify a weakness — complete a few practice attempts first.",
        },
        { status: 404 },
      );
    }

    if (weakest.module === "SPEAKING") {
      const drill = await generateSpeakingDrillQuestion(userId, "part2");
      return Response.json({
        criterion: weakest.criterion,
        module: weakest.module,
        avgBand: weakest.avgBand,
        attemptCount: weakest.attemptCount,
        drillType: "speaking_part2",
        question: { id: drill.questionId, ...drill.contract },
      });
    }

    const taskType = weakest.criterion === "TA" ? ("task1_academic" as const) : ("task2" as const);
    const result = await generateAndPersistQuestion({ taskType, userId });
    return Response.json({
      criterion: weakest.criterion,
      module: weakest.module,
      avgBand: weakest.avgBand,
      attemptCount: weakest.attemptCount,
      drillType: taskType,
      question: { id: result.questionId, ...result.contract, deduped_retry: result.wasDeduped },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
