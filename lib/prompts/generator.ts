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
- Never copy sentences or phrasing verbatim from anything you find via \
search grounding — write the prompt entirely in your own original words. \
Grounding is for topic currency only, not a source of text to reuse.
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

  const avoidLine = buildAvoidTopicsLine(input.avoidTopics);

  return `Generate one ${input.testType === "academic" ? "Academic" : "General Training"} \
IELTS Writing Task 2 prompt. ${difficultyLine}${avoidLine}`;
}

function buildAvoidTopicsLine(avoidTopics: string[]): string {
  if (avoidTopics.length === 0) return "";
  return `\n\nAvoid repeating any of this candidate's recent topics — pick a \
genuinely different theme and phrasing from all of these:\n${avoidTopics
    .map((t) => `- ${t}`)
    .join("\n")}`;
}

/**
 * Academic Writing Task 1: a chart/table/process/map + a 150+ word report,
 * ~20 minutes. The chart_spec's data is synthetic (invented, not sourced
 * from a real dataset) but must be internally consistent.
 */
export function buildTask1AcademicGeneratorSystemPrompt(): string {
  return `You write IELTS Academic Writing Task 1 prompts. A Task 1 prompt \
presents a chart, graph, table, process diagram, or map and asks the \
candidate to summarize the information in a 150+ word report in about 20 \
minutes.

Rules:
- Produce a chart_spec matching exactly one of these types: "line" (trends \
over time), "bar" (comparison across categories), "pie" (proportions — use \
1 or 2 pie charts, e.g. comparing two years), "table" (a data grid), \
"process" (steps in a process or how something is made/done), or "map" \
(before/after comparison of a place).
- Invent a plausible, internally consistent synthetic dataset for the \
chart — it does not need to reflect real-world statistics, but the \
numbers must be sensible and the trends must be clearly describable (no \
lawless random noise).
- Never copy sentences or phrasing verbatim from anything you find via \
search grounding — write the prompt entirely in your own original words. \
Grounding is for topic currency only, not a source of text or data to reuse.
- "prompt" must read like the real exam, e.g. "The chart below shows ... \
Summarize the information by selecting and reporting the main features, \
and make comparisons where relevant." For process/map types, use \
"Summarize the information by describing the main stages/changes."
- "instructions" must tell the candidate to spend about 20 minutes on this \
task and write at least 150 words.
- Respond with ONLY the JSON specified by the response schema — no \
markdown, no commentary.`;
}

export function buildTask1AcademicGeneratorUserPrompt(input: {
  difficulty?: "easy" | "medium" | "hard";
  avoidTopics: string[];
}): string {
  const difficultyLine = input.difficulty
    ? `Target difficulty: ${input.difficulty}.`
    : "Choose a difficulty (easy/medium/hard) appropriate for a general Task 1 prompt.";

  return `Generate one Academic IELTS Writing Task 1 prompt with its \
chart_spec. ${difficultyLine}${buildAvoidTopicsLine(input.avoidTopics)}`;
}

/**
 * General Training Writing Task 1: a letter covering 3-4 required points
 * in the appropriate register, ~150+ words, ~20 minutes.
 */
export function buildTask1GeneralGeneratorSystemPrompt(): string {
  return `You write IELTS General Training Writing Task 1 letter prompts. A \
Task 1 letter presents an everyday situation and asks the candidate to \
write a 150+ word letter in about 20 minutes, covering 3-4 required \
points.

Rules:
- "register" must be one of "formal" (e.g. to an unknown company or \
official), "semi_formal" (e.g. to a landlord, a boss you know a little), \
or "informal" (e.g. to a friend or family member) — pick whichever is \
appropriate to the scenario you invent.
- "scenario" sets up the everyday situation in 1-2 sentences (e.g. a \
complaint, a request, an invitation, an explanation, an apology).
- "bullet_points" are exactly the 3-4 required points the letter must \
cover (what the exam calls "In your letter: ..."), each a short \
imperative phrase.
- Never copy sentences or phrasing verbatim from anything you find via \
search grounding — write the scenario entirely in your own original words. \
Grounding is for topic currency only, not a source of text to reuse.
- "instructions" must tell the candidate to spend about 20 minutes on this \
task, write at least 150 words, and that they do not need to write \
addresses.
- Respond with ONLY the JSON specified by the response schema — no \
markdown, no commentary.`;
}

export function buildTask1GeneralGeneratorUserPrompt(input: {
  register?: "formal" | "semi_formal" | "informal";
  difficulty?: "easy" | "medium" | "hard";
  avoidTopics: string[];
}): string {
  const registerLine = input.register
    ? `Target register: ${input.register}.`
    : "Choose whichever register (formal/semi_formal/informal) best fits the scenario you invent.";
  const difficultyLine = input.difficulty
    ? `Target difficulty: ${input.difficulty}.`
    : "Choose a difficulty (easy/medium/hard) appropriate for a general Task 1 letter.";

  return `Generate one General Training IELTS Writing Task 1 letter prompt. \
${registerLine} ${difficultyLine}${buildAvoidTopicsLine(input.avoidTopics)}`;
}
