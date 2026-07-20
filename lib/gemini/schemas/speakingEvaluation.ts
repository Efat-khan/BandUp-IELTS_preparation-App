import * as z from "zod";

/** Same whole/half-band constraint as Writing — see writingEvaluation.ts. */
const BandValue = z.number().min(0).max(9).multipleOf(0.5);

const CriterionScoreSchema = z.object({
  band: BandValue,
  /** Direct quotes from the candidate's own transcript — never invented. */
  evidence: z.array(z.string().min(3)).min(1).max(4),
  /** Rationale tied to the injected band descriptor language. */
  why: z.string().min(10),
});

const UpgradePhraseSchema = z.object({
  original: z.string().min(1),
  upgraded: z.string().min(1),
  reason: z.string().min(5),
});

/** Structured output contract for a single Speaking scoring pass (spec §10.3). */
export const SpeakingEvaluationSchema = z.object({
  fluency_coherence: CriterionScoreSchema,
  lexical_resource: CriterionScoreSchema,
  grammatical_range_accuracy: CriterionScoreSchema,
  pronunciation: CriterionScoreSchema,
  /** Concrete phrase-upgrade suggestions drawn from the candidate's own transcript. */
  upgrade_phrases: z.array(UpgradePhraseSchema).min(3).max(6),
  /** The evaluator's own self-estimate — audit/drift signal only, never authoritative. */
  estimated_overall_band: BandValue,
});

export type SpeakingEvaluation = z.infer<typeof SpeakingEvaluationSchema>;
export type SpeakingCriterionScore = z.infer<typeof CriterionScoreSchema>;
export type UpgradePhrase = z.infer<typeof UpgradePhraseSchema>;

export const SPEAKING_CRITERION_KEYS = [
  "fluency_coherence",
  "lexical_resource",
  "grammatical_range_accuracy",
  "pronunciation",
] as const;
export type SpeakingCriterionKey = (typeof SPEAKING_CRITERION_KEYS)[number];
