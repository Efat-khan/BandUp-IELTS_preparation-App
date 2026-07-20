import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { rewriteParagraph } from "@/lib/gemini/client";
import {
  buildSpeakingModelAnswerSystemPrompt,
  buildSpeakingModelAnswerUserPrompt,
} from "@/lib/prompts/speakingModelAnswer";

export const dynamic = "force-dynamic";

const MIN_BAND = 4;
const MAX_BAND = 9;

const DISCLAIMER =
  "AI-generated example — not an official IELTS response. Use it to hear what a stronger answer could sound like, not to memorize and recite verbatim.";

interface ModelAnswerRequestBody {
  questionId?: string;
  targetBand?: number;
}

interface CueCardPoints {
  bulletPoints: string[];
  finalPrompt: string;
}

export async function POST(request: NextRequest) {
  try {
    return await handleModelAnswer(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

async function handleModelAnswer(request: NextRequest): Promise<Response> {
  let body: ModelAnswerRequestBody;
  try {
    body = (await request.json()) as ModelAnswerRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.questionId) {
    return Response.json({ error: "questionId is required" }, { status: 400 });
  }
  if (
    typeof body.targetBand !== "number" ||
    body.targetBand < MIN_BAND ||
    body.targetBand > MAX_BAND
  ) {
    return Response.json(
      { error: `targetBand must be a number between ${MIN_BAND} and ${MAX_BAND}` },
      { status: 400 },
    );
  }

  const question = await prisma.question.findUnique({ where: { id: body.questionId } });
  if (!question || question.taskType !== "SPEAKING_PART2") {
    return Response.json(
      { error: "questionId must reference a Speaking Part 2 (cue card) question" },
      { status: 400 },
    );
  }

  const cueCardPoints = question.cueCardPoints as unknown as CueCardPoints | null;
  if (!cueCardPoints) {
    return Response.json({ error: "Question is missing cue card data" }, { status: 500 });
  }

  const systemPrompt = buildSpeakingModelAnswerSystemPrompt();
  const userPrompt = buildSpeakingModelAnswerUserPrompt({
    cueCardTopic: question.prompt,
    bulletPoints: cueCardPoints.bulletPoints,
    finalPrompt: cueCardPoints.finalPrompt,
    targetBand: body.targetBand,
  });

  const modelAnswer = await rewriteParagraph(systemPrompt, userPrompt);

  return Response.json({ modelAnswer, targetBand: body.targetBand, disclaimer: DISCLAIMER });
}
