/**
 * Single source of truth for Gemini model routing (spec §10.1).
 *
 * Never hardcode model names anywhere else in the codebase — swapping a
 * tier is a one-line change here.
 *
 * These are Google's own rolling "-latest" tier aliases
 * (gemini-pro-latest / gemini-flash-latest / gemini-flash-lite-latest),
 * not pinned dated snapshots. A pinned snapshot (e.g. gemini-2.5-flash)
 * previously broke this app in production — new API keys were rejected
 * with a 404 well before that model's official shutdown date, because
 * Google can cut off new-project access to a dated model ahead of its
 * announced deprecation. The "-latest" aliases are Google-maintained and
 * hot-swap to the current recommended model per tier, so this class of
 * outage can't recur here without a code change.
 *
 * Tradeoff: an alias can change which model actually runs underneath a
 * deploy, without a commit to this repo (Google gives ~2 weeks' notice by
 * email for breaking changes behind an alias). That's exactly the kind of
 * silent drift the CI calibration gate (lib/calibration/regressionGate.ts)
 * exists to catch — treat that gate, not this file, as the real defense
 * against a model swap quietly degrading scoring accuracy.
 */

export const GEMINI_MODELS = {
  /** Scoring calls: Pro tier, temperature 0, structured output ON. */
  scoring: "gemini-pro-latest",
  /** Generation: Flash tier, high temperature, Search grounding ON. */
  generation: "gemini-flash-latest",
  /** Pre-checks (cheap validation/classification): Flash-Lite, temperature 0. */
  precheck: "gemini-flash-lite-latest",
} as const;

export const GEMINI_ROUTING = {
  scoring: {
    model: GEMINI_MODELS.scoring,
    temperature: 0,
  },
  generation: {
    model: GEMINI_MODELS.generation,
    temperature: 0.9,
    searchGrounding: true,
  },
  /** Model rewrite ("show me this paragraph at my target band"): Flash, high temp, no grounding — rewriting existing text, not researching. */
  rewrite: {
    model: GEMINI_MODELS.generation,
    temperature: 0.9,
  },
  precheck: {
    model: GEMINI_MODELS.precheck,
    temperature: 0,
  },
  /**
   * Warm-teacher voice (feedback humanizer, coaching chat, plan copy,
   * mini-lessons): Flash, moderately warm. NEVER a scoring path — the
   * teacher only presents bands the cold scorer already produced.
   */
  teacher: {
    model: GEMINI_MODELS.generation,
    temperature: 0.7,
  },
  /** Post-session analysis (session summarizer, error categorizer, profile narrative): Flash, near-deterministic — factual compression, not creative writing. */
  teacherAnalysis: {
    model: GEMINI_MODELS.generation,
    temperature: 0.2,
  },
} as const;
