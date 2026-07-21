import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { errorResponse } from "@/lib/http/errorResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import { evaluateSpeakingSession } from "@/lib/scoring/evaluateSpeaking";
import { persistSpeakingEvaluation } from "@/lib/scoring/persistSpeakingEvaluation";
import { runPostSessionPipelineSafe } from "@/lib/teacher/postSession";
import { mimeTypeForExtension } from "@/lib/speaking/audioFormat";
import { LocalFilesystemStorageProvider, getStorageProvider } from "@/lib/storage/audioStorage";
import type { TranscribedWord } from "@/lib/stt/transcribe";

export const dynamic = "force-dynamic";

/**
 * Re-reads Part 2's audio for the native-audio Gemini call, when possible.
 * Only implemented for the local-filesystem dev fallback, whose URLs
 * (/api/storage/audio/<key>) are directly parseable back to a storage key.
 * S3 URLs vary by provider/config and aren't reliably reversible here, so
 * with S3StorageProvider active this returns null and scoring proceeds
 * text-only — a real limitation, not a silent skip: it only affects the
 * Pronunciation criterion, which still gets an LLM-derived estimate from
 * the transcript and acoustic metrics.
 */
async function tryReadPart2Audio(
  audioUrl: string | null,
): Promise<{ data: Buffer; mimeType: string } | null> {
  if (!audioUrl || !audioUrl.startsWith("/api/storage/audio/")) return null;
  const storage = getStorageProvider();
  if (!(storage instanceof LocalFilesystemStorageProvider)) return null;

  const key = audioUrl.replace("/api/storage/audio/", "");
  try {
    const data = await storage.download(key);
    const extension = key.split(".").pop() ?? "";
    return { data, mimeType: mimeTypeForExtension(extension) };
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = enforceRateLimit(RATE_LIMITS.scoring, request);
    if (limited) return limited;
    return await handleScore(params);
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleScore(paramsPromise: Promise<{ id: string }>): Promise<Response> {
  const { id: sessionId } = await paramsPromise;

  const session = await prisma.speakingSession.findUnique({
    where: { id: sessionId },
    include: { part2Question: true },
  });
  if (!session) {
    return Response.json({ error: "Speaking session not found" }, { status: 404 });
  }

  const [part1Submission, part2Submission, part3Submission] = await Promise.all([
    prisma.submission.findFirst({
      where: { speakingSessionId: sessionId, questionId: session.part1QuestionId },
    }),
    prisma.submission.findFirst({
      where: { speakingSessionId: sessionId, questionId: session.part2QuestionId },
    }),
    prisma.submission.findFirst({
      where: { speakingSessionId: sessionId, questionId: session.part3QuestionId },
    }),
  ]);

  if (!part1Submission?.transcript || !part2Submission?.transcript || !part3Submission?.transcript) {
    return Response.json(
      { error: "All three parts must be recorded and transcribed before scoring" },
      { status: 400 },
    );
  }

  const audio = await tryReadPart2Audio(part2Submission.audioUrl);

  const outcome = await evaluateSpeakingSession({
    cueCardTopic: session.part2Question.prompt,
    part1: {
      transcript: part1Submission.transcript,
      words: (part1Submission.wordTimestamps as unknown as TranscribedWord[]) ?? [],
    },
    part2: {
      transcript: part2Submission.transcript,
      words: (part2Submission.wordTimestamps as unknown as TranscribedWord[]) ?? [],
    },
    part3: {
      transcript: part3Submission.transcript,
      words: (part3Submission.wordTimestamps as unknown as TranscribedWord[]) ?? [],
    },
    audio: audio ?? undefined,
  });

  await prisma.speakingSession.update({
    where: { id: sessionId },
    data: {
      status: "SCORED",
      overallUnrounded: outcome.unroundedOverallBand,
      overallBand: outcome.overallBand,
      criteria: outcome.criteria as unknown as Prisma.InputJsonValue,
      upgradePhrases: outcome.upgradePhrases as unknown as Prisma.InputJsonValue,
      pronunciationSource: outcome.pronunciationSource,
    },
  });

  // Part 2 carries the canonical Score rows (audit trail + progress/weakness-drill queries);
  // Part 1/3 stay as transcript/metrics records only.
  const totalDurationSeconds =
    (part1Submission.durationSeconds ?? 0) +
    (part2Submission.durationSeconds ?? 0) +
    (part3Submission.durationSeconds ?? 0);
  await prisma.submission.update({
    where: { id: part2Submission.id },
    data: { timeSpentSeconds: totalDurationSeconds || null },
  });

  await persistSpeakingEvaluation(outcome, {
    canonicalSubmissionId: part2Submission.id,
    userId: session.userId,
  });

  await Promise.all([
    prisma.submission.update({ where: { id: part1Submission.id }, data: { status: "SCORED" } }),
    prisma.submission.update({ where: { id: part3Submission.id }, data: { status: "SCORED" } }),
  ]);

  await runPostSessionPipelineSafe(part2Submission.id);

  return Response.json({
    sessionId,
    submissionId: part2Submission.id,
    overallBand: outcome.overallBand,
    overallUnrounded: outcome.unroundedOverallBand,
    disagreementFlagged: outcome.disagreementFlagged,
    thirdPassTriggered: outcome.thirdPassTriggered,
    modelSelfEstimatedBand: outcome.modelSelfEstimatedBand,
    pronunciationSource: outcome.pronunciationSource,
    criteria: Object.values(outcome.criteria),
    upgradePhrases: outcome.upgradePhrases,
    acousticFeatures: outcome.acousticFeatures,
    usedNativeAudio: Boolean(audio),
  });
}
