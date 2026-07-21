import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { resolveUserId } from "@/lib/demoUser";
import { errorResponse } from "@/lib/http/errorResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import { evaluateSpeakingSession } from "@/lib/scoring/evaluateSpeaking";
import { persistSpeakingEvaluation } from "@/lib/scoring/persistSpeakingEvaluation";
import { runPostSessionPipelineSafe } from "@/lib/teacher/postSession";
import { extractAcousticFeatures } from "@/lib/speaking/acousticFeatures";
import { extensionForMimeType } from "@/lib/speaking/audioFormat";
import { getStorageProvider } from "@/lib/storage/audioStorage";
import { getSttProvider } from "@/lib/stt/transcribe";

export const dynamic = "force-dynamic";

interface SubmitDrillRequestBody {
  userId?: string;
  questionId?: string;
  audioBase64?: string;
  mimeType?: string;
  timeSpentSeconds?: number;
}

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(RATE_LIMITS.scoring, request);
    if (limited) return limited;
    return await handleSubmit(request);
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleSubmit(request: NextRequest): Promise<Response> {
  let body: SubmitDrillRequestBody;
  try {
    body = (await request.json()) as SubmitDrillRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.questionId || !body.audioBase64 || !body.mimeType) {
    return Response.json(
      { error: "questionId, audioBase64, and mimeType are required" },
      { status: 400 },
    );
  }

  const question = await prisma.question.findUnique({ where: { id: body.questionId } });
  if (!question || (question.taskType !== "SPEAKING_PART1" && question.taskType !== "SPEAKING_PART2")) {
    return Response.json(
      { error: "questionId must reference a Speaking Part 1 or Part 2 question" },
      { status: 400 },
    );
  }

  const userId = await resolveUserId(body.userId);
  const audioBuffer = Buffer.from(body.audioBase64, "base64");
  const storage = getStorageProvider();
  const stt = getSttProvider();

  const partLabel: "part1" | "part2" = question.taskType === "SPEAKING_PART1" ? "part1" : "part2";
  const key = `speaking/drill/${question.id}-${Date.now()}.${extensionForMimeType(body.mimeType)}`;
  const { url: audioUrl } = await storage.upload(key, audioBuffer, body.mimeType);
  const transcription = await stt.transcribe(audioBuffer, body.mimeType);
  const acousticFeatures = extractAcousticFeatures(transcription.words);

  const submission = await prisma.submission.create({
    data: {
      userId,
      questionId: question.id,
      module: "SPEAKING",
      status: "PENDING",
      audioUrl,
      transcript: transcription.transcript,
      durationSeconds: Math.round(transcription.durationSeconds),
      timeSpentSeconds: body.timeSpentSeconds ?? Math.round(transcription.durationSeconds),
      wordTimestamps: transcription.words as unknown as Prisma.InputJsonValue,
      acousticFeatures: acousticFeatures as unknown as Prisma.InputJsonValue,
    },
  });

  const outcome = await evaluateSpeakingSession({
    cueCardTopic: partLabel === "part2" ? question.prompt : undefined,
    part1:
      partLabel === "part1" ? { transcript: transcription.transcript, words: transcription.words } : undefined,
    part2:
      partLabel === "part2" ? { transcript: transcription.transcript, words: transcription.words } : undefined,
  });

  await persistSpeakingEvaluation(outcome, { canonicalSubmissionId: submission.id, userId });
  await runPostSessionPipelineSafe(submission.id);

  return Response.json({
    submissionId: submission.id,
    part: partLabel,
    transcript: transcription.transcript,
    wordTimestamps: transcription.words,
    overallBand: outcome.overallBand,
    overallUnrounded: outcome.unroundedOverallBand,
    disagreementFlagged: outcome.disagreementFlagged,
    thirdPassTriggered: outcome.thirdPassTriggered,
    modelSelfEstimatedBand: outcome.modelSelfEstimatedBand,
    pronunciationSource: outcome.pronunciationSource,
    criteria: Object.values(outcome.criteria),
    upgradePhrases: outcome.upgradePhrases,
    acousticFeatures: outcome.acousticFeatures,
  });
}
