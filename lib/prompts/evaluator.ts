import {
  WRITING_CRITERION_NAMES,
  WRITING_TASK2_CALIBRATION_ANCHORS,
  WRITING_TASK2_DESCRIPTORS,
  type WritingCriterionId,
} from "@/lib/descriptors/writingTask2";
import {
  getWritingTask1Descriptors,
  WRITING_TASK1_CRITERION_NAMES,
  type Task1BandDescriptorTable,
  type WritingTask1CriterionId,
} from "@/lib/descriptors/writingTask1";

const TASK2_CRITERIA_ORDER: WritingCriterionId[] = ["TR", "CC", "LR", "GRA"];
const TASK1_CRITERIA_ORDER: WritingTask1CriterionId[] = ["TA", "CC", "LR", "GRA"];

function renderDescriptorTable(
  label: string,
  criterionId: string,
  table: Task1BandDescriptorTable,
): string {
  const bands = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
  const lines = bands
    .filter((band) => table[band])
    .map((band) => `  Band ${band}: ${table[band]}`);
  return `${label} (${criterionId}):\n${lines.join("\n")}`;
}

function renderCalibrationAnchors(): string {
  const bands = [9, 8, 7, 6, 5, 4] as const;
  return bands
    .filter((band) => WRITING_TASK2_CALIBRATION_ANCHORS[band])
    .map((band) => `  ~Band ${band}: ${WRITING_TASK2_CALIBRATION_ANCHORS[band]}`)
    .join("\n");
}

/**
 * The evaluator NEVER scores from instinct: this system prompt injects the
 * full official band descriptor set plus illustrative calibration anchors
 * every single time a scoring call is made (non-negotiable rule #1).
 */
export function buildWritingTask2EvaluatorSystemPrompt(): string {
  const descriptorBlock = TASK2_CRITERIA_ORDER.map((c) =>
    renderDescriptorTable(WRITING_CRITERION_NAMES[c], c, WRITING_TASK2_DESCRIPTORS[c]),
  ).join("\n\n");

  return `You are an IELTS Writing examiner scoring a Task 2 essay. You score \
strictly against the official IELTS Writing Task 2 band descriptors below — \
never from general impression or instinct.

## Official band descriptors (Task Response, Coherence & Cohesion, Lexical \
Resource, Grammatical Range & Accuracy)

${descriptorBlock}

## Illustrative calibration anchors (register/style only — not ground truth)

${renderCalibrationAnchors()}

${EVALUATOR_RULES}`;
}

/**
 * Task 1 shares the same evaluator rules and JSON contract as Task 2, but
 * scores Task Achievement (TA) instead of Task Response (TR), and TA's
 * descriptor text differs between Academic (accurate data reporting) and
 * General Training (letter purpose/tone/coverage) — see
 * lib/descriptors/writingTask1.ts.
 */
export function buildWritingTask1EvaluatorSystemPrompt(testType: "academic" | "general"): string {
  const descriptors = getWritingTask1Descriptors(testType);
  const descriptorBlock = TASK1_CRITERIA_ORDER.map((c) =>
    renderDescriptorTable(WRITING_TASK1_CRITERION_NAMES[c], c, descriptors[c]),
  ).join("\n\n");

  const taskLabel = testType === "academic" ? "Academic" : "General Training";

  return `You are an IELTS Writing examiner scoring a ${taskLabel} Task 1 \
response. You score strictly against the official IELTS Writing Task 1 \
band descriptors below — never from general impression or instinct.

## Official band descriptors (Task Achievement, Coherence & Cohesion, \
Lexical Resource, Grammatical Range & Accuracy)

${descriptorBlock}

${EVALUATOR_RULES}`;
}

const EVALUATOR_RULES = `## Rules

1. Score EACH of the four criteria independently. Do not let one criterion's \
score influence another.
2. For every criterion, quote 1-4 short fragments taken VERBATIM from the \
candidate's own answer as evidence. Never invent or paraphrase a quote — if \
you cannot find a genuine supporting quote, quote the closest available \
passage and explain the gap in "why" instead.
3. "why" must reference the specific descriptor language that justifies the \
band awarded (e.g. "ideas are relevant and extended but development is \
uneven, consistent with Band 6 rather than Band 7").
4. Bands are always a whole or half band (e.g. 6.0, 6.5, 7.0) — never a \
quarter fraction.
5. List concrete inline_errors (grammar, vocabulary, punctuation, spelling, \
cohesion) with the offending quote, the issue, and a corrected version.
6. next_band_actions must be the 3-6 most impactful, concrete changes that \
would move this specific response to the next band — not generic advice.
7. estimated_task_band is your own holistic best estimate of the overall \
band for this task (average of the four criteria); it is a cross-check \
value, not a substitute for the four independent criterion scores.
8. Output ONLY the structured JSON specified by the response schema — no \
prose, no markdown, no commentary outside the schema fields.`;

export function buildWritingEvaluatorUserPrompt(input: {
  questionPrompt: string;
  instructions: string;
  essayText: string;
  preCheckNotes: string[];
}): string {
  const notes =
    input.preCheckNotes.length > 0
      ? `\n\nDeterministic pre-check notes (already computed in code — treat as \
ground truth, do not recount):\n${input.preCheckNotes.map((n) => `- ${n}`).join("\n")}`
      : "";

  return `## Task prompt
${input.questionPrompt}

## Task instructions
${input.instructions}
${notes}

## Candidate's answer
"""
${input.essayText}
"""

Score this answer against the four criteria and return the structured JSON \
response.`;
}
