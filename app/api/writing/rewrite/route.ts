import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { rewriteParagraph } from "@/lib/gemini/client";
import { buildRewriteSystemPrompt, buildRewriteUserPrompt } from "@/lib/prompts/rewrite";

export const dynamic = "force-dynamic";

const MIN_BAND = 4;
const MAX_BAND = 9;

const DISCLAIMER =
  "AI-generated example — not an official IELTS response. Use it to see what stronger execution of your own idea could look like, not to copy verbatim.";

interface RewriteRequestBody {
  questionPrompt?: string;
  paragraph?: string;
  targetBand?: number;
  /** Optional — if given, persists this rewrite as a Feedback(kind=REWRITE) row on that submission. */
  submissionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    return await handleRewrite(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

async function handleRewrite(request: NextRequest): Promise<Response> {
  let body: RewriteRequestBody;
  try {
    body = (await request.json()) as RewriteRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.paragraph !== "string" || body.paragraph.trim().length === 0) {
    return Response.json({ error: "paragraph is required" }, { status: 400 });
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

  const systemPrompt = buildRewriteSystemPrompt();
  const userPrompt = buildRewriteUserPrompt({
    questionPrompt: body.questionPrompt ?? "",
    paragraph: body.paragraph,
    targetBand: body.targetBand,
  });

  const rewrittenText = await rewriteParagraph(systemPrompt, userPrompt);

  if (body.submissionId) {
    await prisma.feedback.create({
      data: {
        submissionId: body.submissionId,
        kind: "REWRITE",
        content: rewrittenText,
      },
    });
  }

  return Response.json({ rewrittenText, targetBand: body.targetBand, disclaimer: DISCLAIMER });
}
