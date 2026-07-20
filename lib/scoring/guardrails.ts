/**
 * Deterministic scoring guardrails (Phase 1).
 *
 * These live in CODE, not in prompts:
 * - word-count penalties (under-length Task 1 / Task 2 answers)
 * - the official IELTS rounding rule (see rounding.ts)
 * - the double-pass disagreement flag (see doublePass.ts)
 */

export const GUARDRAILS_PLACEHOLDER = true;
