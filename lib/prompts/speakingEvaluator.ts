import {
  SPEAKING_CRITERION_NAMES,
  SPEAKING_DESCRIPTORS,
  type SpeakingCriterionId,
} from "@/lib/descriptors/speaking";

const CRITERIA_ORDER: SpeakingCriterionId[] = ["FC", "LR", "GRA", "PR"];

function renderDescriptorTable(criterion: SpeakingCriterionId): string {
  const table = SPEAKING_DESCRIPTORS[criterion];
  const bands = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
  const lines = bands.filter((b) => table[b]).map((b) => `  Band ${b}: ${table[b]}`);
  return `${SPEAKING_CRITERION_NAMES[criterion]} (${criterion}):\n${lines.join("\n")}`;
}

/**
 * The evaluator NEVER scores from instinct: injects the full official
 * Speaking band descriptor set every scoring call (non-negotiable rule
 * #1, same as Writing). Speaking is scored holistically across all three
 * parts — one set of 4 criterion bands for the whole test, not a per-part
 * score.
 */
export function buildSpeakingEvaluatorSystemPrompt(hasAudio: boolean): string {
  const descriptorBlock = CRITERIA_ORDER.map(renderDescriptorTable).join("\n\n");

  return `You are an IELTS Speaking examiner scoring a candidate's spoken \
performance across Parts 1, 2, and 3 of the test. You score strictly \
against the official IELTS Speaking band descriptors below — never from \
general impression or instinct.

## Official band descriptors (Fluency & Coherence, Lexical Resource, \
Grammatical Range & Accuracy, Pronunciation)

${descriptorBlock}

## Rules

1. Score EACH of the four criteria independently, based on the candidate's \
performance across ALL THREE parts together (this is a single holistic \
Speaking band, not three separate part-scores).
2. For every criterion, quote 1-4 short fragments taken VERBATIM from the \
candidate's own transcript as evidence.
3. "why" must reference the specific descriptor language that justifies \
the band awarded.
4. Bands are always a whole or half band (e.g. 6.0, 6.5, 7.0) — never a \
quarter fraction.
5. You are given DETERMINISTIC ACOUSTIC METRICS computed in code (speech \
rate, filled/silent pauses, mean length of run, self-corrections) for each \
part — treat these as ground truth for Fluency & Coherence. Do not try to \
recompute or contradict them; reason about what they imply instead.
6. ${
    hasAudio
      ? "Raw audio for at least one part is provided — use it as the primary basis for Pronunciation (stress, intonation, individual sounds), which the transcript alone cannot reveal."
      : "No raw audio is provided — derive Pronunciation from whatever textual/acoustic signals are available (e.g. STT confidence, self-corrections near difficult words) and note the extra uncertainty in \"why\"."
  }
7. upgrade_phrases: 3-6 concrete phrases drawn from the transcript, each \
with a more sophisticated alternative and a one-line reason — not generic \
advice.
8. estimated_overall_band is your own holistic best estimate (average of \
the four criteria); a cross-check value, not a substitute for the four \
independent criterion scores.
9. Output ONLY the structured JSON specified by the response schema — no \
prose, no markdown, no commentary outside the schema fields.`;
}

export function buildSpeakingEvaluatorUserPrompt(input: {
  cueCardTopic: string;
  part1Transcript: string;
  part2Transcript: string;
  part3Transcript: string;
  part1MetricsSummary: string;
  part2MetricsSummary: string;
  part3MetricsSummary: string;
}): string {
  return `## Part 2 cue card topic
${input.cueCardTopic}

## Deterministic acoustic metrics (computed in code — treat as ground truth)
${input.part1MetricsSummary}
${input.part2MetricsSummary}
${input.part3MetricsSummary}

## Part 1 transcript
"""
${input.part1Transcript}
"""

## Part 2 transcript
"""
${input.part2Transcript}
"""

## Part 3 transcript
"""
${input.part3Transcript}
"""

Score this candidate's overall Speaking performance across all three parts \
against the four criteria and return the structured JSON response.`;
}
