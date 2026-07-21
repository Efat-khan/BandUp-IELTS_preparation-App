import * as z from "zod";

/**
 * Structured-output contracts for the Personal Teacher Layer.
 *
 * The band fields that appear here (HumanizedFeedback) are ECHOES of DB
 * values injected into the prompt — never new judgments. The orchestrator
 * asserts them unchanged against the DB before anything reaches the
 * learner (see lib/teacher/orchestrator.ts).
 */

const BandValue = z.number().min(0).max(9).multipleOf(0.5);

export const CriterionIdSchema = z.enum(["TR", "TA", "CC", "LR", "GRA", "FC", "PR"]);
export type CriterionId = z.infer<typeof CriterionIdSchema>;

// ── Post-session pipeline ──────────────────────────────────────────────

export const SessionSummaryLLMSchema = z.object({
  /** 3-6 sentence factual summary of the session for the tutor's memory. */
  summary: z.string().min(40),
  wins: z.array(z.string().min(5)).min(1).max(4),
  struggles: z.array(z.string().min(5)).min(1).max(4),
  next_focus: z.string().min(10),
});
export type SessionSummaryLLMOutput = z.infer<typeof SessionSummaryLLMSchema>;

export const CategorizedErrorSchema = z.object({
  /** Stable snake_case machine key for the error family, e.g. "articles_missing", "comma_splice". */
  error_key: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "snake_case key"),
  label: z.string().min(5).max(120),
  criterion: CriterionIdSchema,
  /** A representative quote from the learner's own work in THIS session. */
  example: z.string().min(3),
  /** How many times this family occurred in THIS session. */
  count: z.number().int().min(1).max(50),
});

export const ErrorCategorizationLLMSchema = z.object({
  errors: z.array(CategorizedErrorSchema).max(10),
});
export type ErrorCategorizationLLMOutput = z.infer<typeof ErrorCategorizationLLMSchema>;
export type CategorizedError = z.infer<typeof CategorizedErrorSchema>;

export const ProfileNarrativeLLMSchema = z.object({
  /** The tutor's running prose picture of this learner — rewritten whole each time, 4-8 sentences. */
  narrative: z.string().min(80),
});
export type ProfileNarrativeLLMOutput = z.infer<typeof ProfileNarrativeLLMSchema>;

// ── Feedback humanizer ─────────────────────────────────────────────────

export const HumanizedCriterionSchema = z.object({
  criterion: CriterionIdSchema,
  /** ECHO of the DB band, asserted unchanged in code — never a new judgment. */
  band: BandValue,
  comment: z.string().min(20),
});

export const HumanizedFeedbackLLMSchema = z.object({
  greeting: z.string().min(10),
  /** ECHO of the DB overall band, asserted unchanged in code. */
  overall_band: BandValue,
  overall_comment: z.string().min(30),
  criterion_comments: z.array(HumanizedCriterionSchema).min(3).max(5),
  /** The single highest-impact thing to do before the next attempt. */
  priority_action: z.string().min(15),
  encouragement: z.string().min(10),
});
export type HumanizedFeedbackLLMOutput = z.infer<typeof HumanizedFeedbackLLMSchema>;

// ── Study plan copy ────────────────────────────────────────────────────

export const StudyPlanUnitCopySchema = z.object({
  /** Mirrors the code-decided unit's position so copy is matched deterministically. */
  position: z.number().int().min(0).max(20),
  title: z.string().min(5).max(90),
  rationale: z.string().min(30),
  actions: z.array(z.string().min(10)).min(2).max(4),
});

export const StudyPlanCopyLLMSchema = z.object({
  introduction: z.string().min(50),
  units: z.array(StudyPlanUnitCopySchema).min(1).max(12),
});
export type StudyPlanCopyLLMOutput = z.infer<typeof StudyPlanCopyLLMSchema>;

// ── Mini-lessons ───────────────────────────────────────────────────────

export const MiniLessonLLMSchema = z.object({
  title: z.string().min(5).max(90),
  /** Markdown: what the error is, why it matters at the learner's level, 2-3 examples built on the learner's OWN sentences, one micro-exercise. */
  content: z.string().min(200),
});
export type MiniLessonLLMOutput = z.infer<typeof MiniLessonLLMSchema>;
