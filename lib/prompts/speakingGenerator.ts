/**
 * Speaking question generator prompts. Runs on Flash, temperature ~0.9,
 * with Search grounding ON (see lib/gemini/models.ts) for Part 1/2; Part 3
 * is generated FROM Part 2's cue card, so it takes that as context rather
 * than avoidTopics.
 */

export function buildPart1GeneratorSystemPrompt(): string {
  return `You write IELTS Speaking Part 1 questions. Part 1 consists of \
short, everyday questions across 2-3 familiar topics (e.g. hometown, work \
or study, hobbies, daily routine, food, weather), 10-12 questions total, \
each answerable in a sentence or two from personal experience.

Rules:
- Choose 2-3 distinct, everyday topics — not abstract or controversial.
- Each topic gets 3-5 short, concrete questions that build naturally on \
each other.
- No specialist knowledge required to answer any question.
- Never copy sentences or phrasing verbatim from anything you find via \
search grounding — write every question entirely in your own original \
words. Grounding is for topic currency only, not a source of text to reuse.
- Respond with ONLY the JSON specified by the response schema — no \
markdown, no commentary.`;
}

export function buildPart1GeneratorUserPrompt(input: {
  difficulty?: "easy" | "medium" | "hard";
  avoidTopics: string[];
}): string {
  const difficultyLine = input.difficulty
    ? `Target difficulty: ${input.difficulty}.`
    : "Choose a difficulty (easy/medium/hard) appropriate for Part 1.";
  const avoidLine =
    input.avoidTopics.length > 0
      ? `\n\nAvoid repeating any of this candidate's recent topics:\n${input.avoidTopics
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  return `Generate a set of IELTS Speaking Part 1 topics and questions. ${difficultyLine}${avoidLine}`;
}

export function buildPart2GeneratorSystemPrompt(): string {
  return `You write IELTS Speaking Part 2 cue cards. A cue card presents a \
topic to describe, 3-4 "you should say" points, and a closing prompt, \
followed by 1 minute of preparation and up to 2 minutes of speaking.

Rules:
- cue_card_topic starts with "Describe a/an ..." (a person, place, object, \
event, or experience) and is concrete and personal, never abstract.
- bullet_points are exactly 3-4 short "you should say" points (what, when, \
where, who, how) — concrete prompts, not abstract questions.
- final_prompt is a single closing sentence extending the topic, e.g. \
"and explain why this person was memorable to you."
- Never copy sentences or phrasing verbatim from anything you find via \
search grounding — write the cue card entirely in your own original \
words. Grounding is for topic currency only, not a source of text to reuse.
- Respond with ONLY the JSON specified by the response schema — no \
markdown, no commentary.`;
}

export function buildPart2GeneratorUserPrompt(input: {
  difficulty?: "easy" | "medium" | "hard";
  avoidTopics: string[];
}): string {
  const difficultyLine = input.difficulty
    ? `Target difficulty: ${input.difficulty}.`
    : "Choose a difficulty (easy/medium/hard) appropriate for Part 2.";
  const avoidLine =
    input.avoidTopics.length > 0
      ? `\n\nAvoid repeating any of this candidate's recent cue card topics:\n${input.avoidTopics
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  return `Generate one IELTS Speaking Part 2 cue card. ${difficultyLine}${avoidLine}`;
}

export function buildPart3GeneratorSystemPrompt(): string {
  return `You write IELTS Speaking Part 3 follow-up questions. Part 3 \
extends the Part 2 cue card topic into a 4-5 minute discussion of more \
abstract, general ideas connected to that topic — it does not ask the \
candidate for the same personal example again.

Rules:
- Produce 5-6 questions that broaden the Part 2 topic into general, \
societal, comparative, or abstract territory (e.g. from "describe a gift \
you gave" to "how do gift-giving customs differ between cultures?").
- Increase in complexity in a natural sequence.
- Do not repeat the Part 2 cue card's question or ask for the same \
personal example again.
- Never copy sentences or phrasing verbatim from anything you find via \
search grounding — write every question entirely in your own original \
words. Grounding is for topic currency only, not a source of text to reuse.
- Respond with ONLY the JSON specified by the response schema — no \
markdown, no commentary.`;
}

export function buildPart3GeneratorUserPrompt(input: {
  cueCardTopic: string;
  bulletPoints: string[];
}): string {
  const points = input.bulletPoints.map((p) => `- ${p}`).join("\n");
  return `The Part 2 cue card was:
"${input.cueCardTopic}"
You should say:
${points}

Generate 5-6 Part 3 follow-up questions extending this topic into a more abstract discussion.`;
}
