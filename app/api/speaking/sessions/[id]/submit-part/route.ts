import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { errorResponse } from "@/lib/http/errorResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit/enforce";
import { extractAcousticFeatures } from "@/lib/speaking/acousticFeatures";
import { extensionForMimeType } from "@/lib/speaking/audioFormat";
import { getStorageProvider } from "@/lib/storage/audioStorage";
import { getSttProvider } from "@/lib/stt/transcribe";

export const dynamic = "force-dynamic";

type Part = "part1" | "part2" | "part3";

const PART_QUESTION_FIELD: Record<Part, "part1QuestionId" | "part2QuestionId" | "part3QuestionId"> = {
  part1: "part1QuestionId",
  part2: "part2QuestionId",
  part3: "part3QuestionId",
};

interface SubmitPartRequestBody {
  part?: Part;
  audioBase64?: string;
  mimeType?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = enforceRateLimit(RATE_LIMITS.media, request);
    if (limited) return limited;
    return await handleSubmitPart(request, params);
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleSubmitPart(
  request: Request,
  paramsPromise: Promise<{ id: string }>,
): Promise<Response> {
  const { id: sessionId } = await paramsPromise;

  let body: SubmitPartRequestBody;
  try {
    body = (await request.json()) as SubmitPartRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.part || !PART_QUESTION_FIELD[body.part] || !body.audioBase64 || !body.mimeType) {
    return Response.json(
      { error: "part (part1|part2|part3), audioBase64, and mimeType are required" },
      { status: 400 },
    );
  }

  const session = await prisma.speakingSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return Response.json({ error: "Speaking session not found" }, { status: 404 });
  }

  const questionId = session[PART_QUESTION_FIELD[body.part]];
  const audioBuffer = Buffer.from(body.audioBase64, "base64");

  const storage = getStorageProvider();
  const stt = getSttProvider();

  const key = `speaking/${sessionId}/${body.part}.${extensionForMimeType(body.mimeType)}`;
  const { url: audioUrl } = await storage.upload(key, audioBuffer, body.mimeType);
  const transcription = await stt.transcribe(audioBuffer, body.mimeType);
  const acousticFeatures = extractAcousticFeatures(transcription.words);

  const existing = await prisma.submission.findFirst({
    where: { speakingSessionId: sessionId, questionId },
  });

  const submission = existing
    ? await prisma.submission.update({
        where: { id: existing.id },
        data: {
          audioUrl,
          transcript: transcription.transcript,
          durationSeconds: Math.round(transcription.durationSeconds),
          wordTimestamps: transcription.words as unknown as Prisma.InputJsonValue,
          acousticFeatures: acousticFeatures as unknown as Prisma.InputJsonValue,
        },
      })
    : await prisma.submission.create({
        data: {
          userId: session.userId,
          questionId,
          module: "SPEAKING",
          status: "PENDING",
          audioUrl,
          transcript: transcription.transcript,
          durationSeconds: Math.round(transcription.durationSeconds),
          wordTimestamps: transcription.words as unknown as Prisma.InputJsonValue,
          acousticFeatures: acousticFeatures as unknown as Prisma.InputJsonValue,
          speakingSessionId: sessionId,
        },
      });

  return Response.json({
    submissionId: submission.id,
    part: body.part,
    audioUrl,
    transcript: transcription.transcript,
    wordTimestamps: transcription.words,
    acousticFeatures,
  });
}
