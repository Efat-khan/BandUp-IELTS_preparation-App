/**
 * "Model cue-card answer" — a coaching aid, not a scoring call. Reuses the
 * same Flash/high-temperature/no-grounding tier as the Writing rewrite
 * feature (GEMINI_ROUTING.rewrite).
 */

export function buildSpeakingModelAnswerSystemPrompt(): string {
  return `You are an IELTS Speaking coach. You write a sample spoken-style \
answer to a Part 2 cue card at a specific target band.

Rules:
- Cover the cue card's topic and all "you should say" points naturally, \
as a real spoken answer would (roughly 200-250 words — about 2 minutes \
spoken).
- Match the target band's fluency, vocabulary, and grammatical range as \
described in the official IELTS Speaking band descriptors.
- Sound like natural speech, not a written essay — use spoken discourse \
markers ("well", "so", "actually", "I guess"), not formal written \
connectors.
- Output ONLY the answer text — no preamble, no explanation, no markdown, \
no quotation marks around it.`;
}

export function buildSpeakingModelAnswerUserPrompt(input: {
  cueCardTopic: string;
  bulletPoints: string[];
  finalPrompt: string;
  targetBand: number;
}): string {
  const points = input.bulletPoints.map((p) => `- ${p}`).join("\n");
  return `## Cue card
${input.cueCardTopic}
You should say:
${points}
${input.finalPrompt}

Write a sample spoken answer that would plausibly achieve IELTS Speaking Band ${input.targetBand}.`;
}
