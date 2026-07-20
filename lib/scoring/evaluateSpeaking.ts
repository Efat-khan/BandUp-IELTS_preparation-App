import {
  buildSpeakingEvaluatorSystemPrompt,
  buildSpeakingEvaluatorUserPrompt,
} from "@/lib/prompts/speakingEvaluator";
import {
  extractAcousticFeatures,
  formatAcousticFeaturesSummary,
  type AcousticFeatures,
  type TimestampedWord,
} from "@/lib/speaking/acousticFeatures";
import { resolvePronunciationBand, type PronunciationSource } from "@/lib/speaking/pronunciation";
import type { SpeakingCriterionKey } from "@/lib/gemini/schemas/speakingEvaluation";
import type { UpgradePhrase } from "@/lib/gemini/schemas/speakingEvaluation";
import { runSpeakingDoublePassScoring } from "./speakingDoublePass";
import { combineTaskBand } from "./taskBand";

/**
 * Core Speaking evaluation pipeline — holistic across all 3 parts (see
 * lib/prompts/speakingEvaluator.ts), unlike Writing's per-task scoring.
 * Contains no DB/HTTP concerns so it's directly unit-testable and reusable
 * from a future calibration harness.
 */

export type SpeakingCriterionId = "FC" | "LR" | "GRA" | "PR";

export interface SpeakingPartInput {
  transcript: string;
  words: TimestampedWord[];
}

export interface SpeakingEvaluationInput {
  cueCardTopic: string;
  part1: SpeakingPartInput;
  part2: SpeakingPartInput;
  part3: SpeakingPartInput;
  /** Optional raw audio (typically Part 2's recording) for richer Pronunciation judgment. */
  audio?: { data: Buffer; mimeType: string };
}

export interface SpeakingCriterionOutcome {
  criterion: SpeakingCriterionId;
  band: number;
  evidence: string[];
  why: string;
}

export interface SpeakingEvaluationOutcome {
  criteria: Record<SpeakingCriterionId, SpeakingCriterionOutcome>;
  upgradePhrases: UpgradePhrase[];
  disagreementFlagged: boolean;
  unroundedOverallBand: number;
  overallBand: number;
  modelSelfEstimatedBand: number;
  pronunciationSource: PronunciationSource;
  acousticFeatures: { part1: AcousticFeatures; part2: AcousticFeatures; part3: AcousticFeatures };
}

const CRITERION_KEY_MAP: Record<SpeakingCriterionId, SpeakingCriterionKey> = {
  FC: "fluency_coherence",
  LR: "lexical_resource",
  GRA: "grammatical_range_accuracy",
  PR: "pronunciation",
};

export async function evaluateSpeakingSession(
  input: SpeakingEvaluationInput,
): Promise<SpeakingEvaluationOutcome> {
  const part1Features = extractAcousticFeatures(input.part1.words);
  const part2Features = extractAcousticFeatures(input.part2.words);
  const part3Features = extractAcousticFeatures(input.part3.words);

  const systemPrompt = buildSpeakingEvaluatorSystemPrompt(Boolean(input.audio));
  const userPrompt = buildSpeakingEvaluatorUserPrompt({
    cueCardTopic: input.cueCardTopic,
    part1Transcript: input.part1.transcript,
    part2Transcript: input.part2.transcript,
    part3Transcript: input.part3.transcript,
    part1MetricsSummary: formatAcousticFeaturesSummary(part1Features, "Part 1"),
    part2MetricsSummary: formatAcousticFeaturesSummary(part2Features, "Part 2"),
    part3MetricsSummary: formatAcousticFeaturesSummary(part3Features, "Part 3"),
  });

  const doublePass = await runSpeakingDoublePassScoring(systemPrompt, userPrompt, input.audio ?? null);

  const criteria = {} as Record<SpeakingCriterionId, SpeakingCriterionOutcome>;
  for (const criterionId of ["FC", "LR", "GRA", "PR"] as const) {
    const key = CRITERION_KEY_MAP[criterionId];
    criteria[criterionId] = {
      criterion: criterionId,
      band: doublePass.canonicalBands[key],
      // Qualitative fields aren't meaningfully averaged across passes — use pass 1.
      evidence: doublePass.pass1[key].evidence,
      why: doublePass.pass1[key].why,
    };
  }

  const pronunciation = await resolvePronunciationBand({
    llmPronunciationBand: criteria.PR.band,
    audio: input.audio,
    referenceText: input.part2.transcript,
  });
  criteria.PR.band = pronunciation.band;

  // Equal-weighted 4-criterion average + official rounding — same math as
  // Writing's per-task band (lib/scoring/taskBand.ts), just relabeled.
  const { unrounded, band } = combineTaskBand(
    criteria.FC.band,
    criteria.LR.band,
    criteria.GRA.band,
    criteria.PR.band,
  );

  return {
    criteria,
    upgradePhrases: doublePass.pass1.upgrade_phrases,
    disagreementFlagged: doublePass.disagreementFlagged,
    unroundedOverallBand: unrounded,
    overallBand: band,
    modelSelfEstimatedBand:
      (doublePass.pass1.estimated_overall_band + doublePass.pass2.estimated_overall_band) / 2,
    pronunciationSource: pronunciation.source,
    acousticFeatures: { part1: part1Features, part2: part2Features, part3: part3Features },
  };
}
