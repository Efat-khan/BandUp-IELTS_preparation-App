/**
 * Double-pass scoring (Phase 1).
 *
 * Every submission is scored twice at temperature 0; if the two passes
 * disagree beyond the allowed tolerance, the submission is flagged
 * (Submission.disagreementFlagged) instead of silently averaged.
 */

export const DOUBLE_PASS_PLACEHOLDER = true;
