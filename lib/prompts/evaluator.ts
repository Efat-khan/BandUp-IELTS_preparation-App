/**
 * Evaluator system prompts (Phase 1).
 *
 * Non-negotiable rules (see BandUp_Documentation.md):
 * - The evaluator NEVER scores from instinct: every scoring prompt must
 *   inject the official band descriptors (lib/descriptors) plus calibration
 *   examples into the system prompt.
 * - Each of the 4 criteria is scored separately, with evidence quoted from
 *   the candidate's own answer.
 * - Output is always structured (responseSchema) — never JSON-in-prose.
 */

export const EVALUATOR_PROMPTS_PLACEHOLDER = true;
