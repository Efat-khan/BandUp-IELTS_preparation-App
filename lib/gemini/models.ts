/**
 * Single source of truth for Gemini model routing (spec §10.1).
 *
 * Pin STABLE versioned model IDs here only — never hardcode model names
 * anywhere else in the codebase. Swapping a tier is a one-line change.
 */

export const GEMINI_MODELS = {
  /** Scoring calls: Pro tier, temperature 0, structured output ON. */
  scoring: "gemini-2.5-pro",
  /** Generation: Flash tier, high temperature, Search grounding ON. */
  generation: "gemini-2.5-flash",
  /** Pre-checks (cheap validation/classification): Flash-Lite, temperature 0. */
  precheck: "gemini-2.5-flash-lite",
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
} as const;
