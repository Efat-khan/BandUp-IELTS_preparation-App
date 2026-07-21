/**
 * Bump this whenever the evaluator's scoring logic meaningfully changes —
 * band descriptors, system prompts, the structured-output schema, or the
 * code guardrails (word-count penalty, calibration ceiling, rounding).
 * Stored on every Score row; the progress dashboard's trend lines only
 * ever chart scores from a single version together (never mixed), since a
 * band jump caused by a prompt change isn't real user progress.
 *
 * Deliberately independent of the pinned Gemini model IDs (lib/gemini/models.ts)
 * — those are tracked separately per Score row via `modelId`. A model
 * upgrade with no prompt/schema/guardrail changes doesn't need a version bump.
 */
export const EVALUATOR_VERSION = "2026.07-v1";
