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
import type {
  SpeakingCriterionKey,
  SpeakingEvaluation,
  UpgradePhrase,
} from "@/lib/gemini/schemas/speakingEvaluation";
import { runSpeakingDoublePassScoring } from "./speakingDoublePass";
import { combineTaskBand } from "./taskBand";

/**
 * Core Speaking evaluation pipeline — holistic across whichever parts are
 * provided (see lib/prompts/speakingEvaluator.ts), unlike Writing's
 * per-task scoring. Contains no DB/HTTP concerns so it's directly
 * unit-testable and reusable from a future calibration harness.
 *
 * Full mock: pass all three parts. Quick drill (a single Part 1/2/3
 * recording scored on its own): pass just the one part present — the
 * missing parts are noted to the evaluator as "not attempted" rather than
 * silently treated as empty, and evidence is drawn only from what's real.
 */

export type SpeakingCriterionId = "FC" | "LR" | "GRA" | "PR";

export interface SpeakingPartInput {
  transcript: string;
  words: TimestampedWord[];
}

export interface SpeakingEvaluationInput {
  /** Only meaningful/known when Part 2 was attempted. */
  cueCardTopic?: string;
  part1?: SpeakingPartInput;
  part2?: SpeakingPartInput;
  part3?: SpeakingPartInput;
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
  acousticFeatures: {
    part1: AcousticFeatures | null;
    part2: AcousticFeatures | null;
    part3: AcousticFeatures | null;
  };
  /** Raw double-pass audit trail — persisted as Score rows (pass 1/2) alongside the canonical pass 0. */
  pass1: SpeakingEvaluation;
  pass2: SpeakingEvaluation;
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
  if (!input.part1 && !input.part2 && !input.part3) {
    throw new Error("At least one of part1, part2, or part3 must be provided");
  }

  const part1Features = input.part1 ? extractAcousticFeatures(input.part1.words) : null;
  const part2Features = input.part2 ? extractAcousticFeatures(input.part2.words) : null;
  const part3Features = input.part3 ? extractAcousticFeatures(input.part3.words) : null;

  const systemPrompt = buildSpeakingEvaluatorSystemPrompt(Boolean(input.audio));
  const userPrompt = buildSpeakingEvaluatorUserPrompt({
    cueCardTopic: input.cueCardTopic,
    part1: input.part1 && part1Features
      ? { transcript: input.part1.transcript, metricsSummary: formatAcousticFeaturesSummary(part1Features, "Part 1") }
      : undefined,
    part2: input.part2 && part2Features
      ? { transcript: input.part2.transcript, metricsSummary: formatAcousticFeaturesSummary(part2Features, "Part 2") }
      : undefined,
    part3: input.part3 && part3Features
      ? { transcript: input.part3.transcript, metricsSummary: formatAcousticFeaturesSummary(part3Features, "Part 3") }
      : undefined,
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
    referenceText: input.part2?.transcript ?? input.part1?.transcript ?? input.part3?.transcript ?? "",
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
    pass1: doublePass.pass1,
    pass2: doublePass.pass2,
  };
}
