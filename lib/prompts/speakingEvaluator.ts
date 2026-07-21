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
 * #1, same as Writing). A full mock is scored holistically across all
 * three parts — one set of 4 criterion bands, not a per-part score. A
 * quick drill (only some parts attempted) is scored the same way, just
 * with a smaller evidence base — the prompt tells the model exactly which
 * parts are missing so it never invents content for them.
 */
export function buildSpeakingEvaluatorSystemPrompt(hasAudio: boolean): string {
  const descriptorBlock = CRITERIA_ORDER.map(renderDescriptorTable).join("\n\n");

  return `You are an IELTS Speaking examiner scoring a candidate's spoken \
performance. You score strictly against the official IELTS Speaking band \
descriptors below — never from general impression or instinct.

## Official band descriptors (Fluency & Coherence, Lexical Resource, \
Grammatical Range & Accuracy, Pronunciation)

${descriptorBlock}

## Rules

1. Score EACH of the four criteria independently, based on the candidate's \
performance across whichever part(s) are provided below (this is a single \
holistic Speaking band, not separate per-part scores). If only one or two \
parts were attempted, that does not reduce the accuracy of what you can \
observe from them — just note the smaller evidence base in "why" where \
relevant.
2. For every criterion, quote 1-4 short fragments taken VERBATIM from the \
candidate's own transcript as evidence. Never invent content for a part \
that was not attempted.
3. "why" must reference the specific descriptor language that justifies \
the band awarded.
4. Bands are always a whole or half band (e.g. 6.0, 6.5, 7.0) — never a \
quarter fraction.
5. You are given DETERMINISTIC ACOUSTIC METRICS computed in code (speech \
rate, filled/silent pauses, mean length of run, self-corrections) for each \
attempted part — treat these as ground truth for Fluency & Coherence. Do \
not try to recompute or contradict them; reason about what they imply \
instead.
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

interface SpeakingPartPromptInput {
  transcript: string;
  metricsSummary: string;
}

export function buildSpeakingEvaluatorUserPrompt(input: {
  cueCardTopic?: string;
  part1?: SpeakingPartPromptInput;
  part2?: SpeakingPartPromptInput;
  part3?: SpeakingPartPromptInput;
}): string {
  const metricsLines = [input.part1, input.part2, input.part3]
    .filter((p): p is SpeakingPartPromptInput => Boolean(p))
    .map((p) => p.metricsSummary)
    .join("\n");

  const renderPart = (label: string, part?: SpeakingPartPromptInput): string =>
    part
      ? `## ${label} transcript\n"""\n${part.transcript}\n"""`
      : `## ${label}\nNot attempted in this session.`;

  const cueCardBlock = input.cueCardTopic
    ? `## Part 2 cue card topic\n${input.cueCardTopic}\n\n`
    : "";

  return `${cueCardBlock}## Deterministic acoustic metrics (computed in code — treat as ground truth)
${metricsLines}

${renderPart("Part 1", input.part1)}

${renderPart("Part 2", input.part2)}

${renderPart("Part 3", input.part3)}

Score this candidate's Speaking performance against the four criteria \
based on whichever part(s) were attempted, and return the structured JSON \
response.`;
}
