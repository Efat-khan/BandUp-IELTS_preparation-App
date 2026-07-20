/**
 * Task 2 question generator prompts. Runs on Flash, temperature ~0.9, with
 * Search grounding ON (see lib/gemini/models.ts) so topics stay current
 * rather than recycling a fixed bank.
 */

export function buildTask2GeneratorSystemPrompt(): string {
  return `You write IELTS Academic/General Training Writing Task 2 essay \
prompts. A Task 2 prompt presents an issue, opinion, or discussion topic and \
asks the candidate to write a 250+ word argumentative/discursive essay in \
about 40 minutes.

Rules:
- The prompt must be answerable in one of the standard Task 2 patterns: \
opinion (agree/disagree), discuss both views, advantages/disadvantages, \
problem/solution, or two-part question.
- Use current, real-world context where relevant (you have search \
grounding — prefer topics with genuine present-day relevance over generic \
recycled prompts) without requiring specialist knowledge to answer.
- "instructions" must tell the candidate to spend about 40 minutes on this \
task and write at least 250 words.
- Keep the prompt to 2-4 sentences, in the standard IELTS register.
- Respond with ONLY the JSON specified by the response schema — no \
markdown, no commentary.`;
}

export function buildTask2GeneratorUserPrompt(input: {
  testType: "academic" | "general";
  difficulty?: "easy" | "medium" | "hard";
  avoidTopics: string[];
}): string {
  const difficultyLine = input.difficulty
    ? `Target difficulty: ${input.difficulty}.`
    : "Choose a difficulty (easy/medium/hard) appropriate for a general Task 2 prompt.";

  const avoidLine =
    input.avoidTopics.length > 0
      ? `\n\nAvoid repeating any of this candidate's recent topics — pick a \
genuinely different theme and phrasing from all of these:\n${input.avoidTopics
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  return `Generate one ${input.testType === "academic" ? "Academic" : "General Training"} \
IELTS Writing Task 2 prompt. ${difficultyLine}${avoidLine}`;
}
