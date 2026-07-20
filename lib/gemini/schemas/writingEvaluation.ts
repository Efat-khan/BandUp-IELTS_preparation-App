import * as z from "zod";

/**
 * IELTS bands are only ever whole or half bands per criterion — the
 * quarter-fractions (x.25/x.75) only arise from averaging multiple
 * criteria/tasks together, never from a single criterion score itself.
 * `multipleOf` is a real JSON Schema keyword, so this constrains Gemini's
 * structured output directly (not just a post-hoc runtime check).
 */
const BandValue = z.number().min(0).max(9).multipleOf(0.5);

const CriterionScoreSchema = z.object({
  band: BandValue,
  /** Direct quotes from the candidate's own answer — never invented. */
  evidence: z.array(z.string().min(3)).min(1).max(4),
  /** Rationale tied to the injected band descriptor language. */
  why: z.string().min(10),
});

const InlineErrorSchema = z.object({
  quote: z.string().min(1),
  issue: z.string().min(1),
  correction: z.string().min(1),
  category: z.enum(["grammar", "vocabulary", "punctuation", "spelling", "cohesion"]),
});

/** Structured output contract for a single scoring pass (spec §10.2). */
export const WritingEvaluationSchema = z.object({
  task_response: CriterionScoreSchema,
  coherence_cohesion: CriterionScoreSchema,
  lexical_resource: CriterionScoreSchema,
  grammatical_range_accuracy: CriterionScoreSchema,
  inline_errors: z.array(InlineErrorSchema).max(15).default([]),
  next_band_actions: z.array(z.string().min(5)).min(3).max(6),
  /** The evaluator's own self-estimate — audit/drift signal only, never authoritative. */
  estimated_task_band: BandValue,
});

export type WritingEvaluation = z.infer<typeof WritingEvaluationSchema>;
export type CriterionScore = z.infer<typeof CriterionScoreSchema>;
export type InlineError = z.infer<typeof InlineErrorSchema>;

export const WRITING_CRITERION_KEYS = [
  "task_response",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
] as const;
export type WritingCriterionKey = (typeof WRITING_CRITERION_KEYS)[number];
