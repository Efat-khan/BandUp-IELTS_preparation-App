import {
  WRITING_CRITERION_NAMES,
  WRITING_TASK2_CALIBRATION_ANCHORS,
  WRITING_TASK2_DESCRIPTORS,
  type WritingCriterionId,
} from "@/lib/descriptors/writingTask2";

const CRITERIA_ORDER: WritingCriterionId[] = ["TR", "CC", "LR", "GRA"];

function renderDescriptorTable(criterion: WritingCriterionId): string {
  const table = WRITING_TASK2_DESCRIPTORS[criterion];
  const bands = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
  const lines = bands
    .filter((band) => table[band])
    .map((band) => `  Band ${band}: ${table[band]}`);
  return `${WRITING_CRITERION_NAMES[criterion]} (${criterion}):\n${lines.join("\n")}`;
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
  const descriptorBlock = CRITERIA_ORDER.map(renderDescriptorTable).join("\n\n");

  return `You are an IELTS Writing examiner scoring a Task 2 essay. You score \
strictly against the official IELTS Writing Task 2 band descriptors below — \
never from general impression or instinct.

## Official band descriptors (Task Response, Coherence & Cohesion, Lexical \
Resource, Grammatical Range & Accuracy)

${descriptorBlock}

## Illustrative calibration anchors (register/style only — not ground truth)

${renderCalibrationAnchors()}

## Rules

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
would move this specific essay to the next band — not generic advice.
7. estimated_task_band is your own holistic best estimate of the overall \
Task 2 band (average of the four criteria); it is a cross-check value, not \
a substitute for the four independent criterion scores.
8. Output ONLY the structured JSON specified by the response schema — no \
prose, no markdown, no commentary outside the schema fields.`;
}

export function buildWritingTask2EvaluatorUserPrompt(input: {
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

  return `## Task 2 prompt
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
