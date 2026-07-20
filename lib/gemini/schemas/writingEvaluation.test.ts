import { describe, expect, it } from "vitest";
import { WritingEvaluationSchema } from "./writingEvaluation";

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const criterion = { band: 6.5, evidence: ["a quoted fragment"], why: "a rationale referencing descriptor language" };
  return {
    task_response: criterion,
    coherence_cohesion: criterion,
    lexical_resource: criterion,
    grammatical_range_accuracy: criterion,
    inline_errors: [],
    next_band_actions: ["action one here", "action two here", "action three here"],
    estimated_task_band: 6.5,
    ...overrides,
  };
}

describe("WritingEvaluationSchema", () => {
  it("accepts a well-formed payload", () => {
    const result = WritingEvaluationSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("rejects a band that isn't a whole or half band", () => {
    const payload = validPayload({
      task_response: { band: 6.3, evidence: ["quote"], why: "rationale text here" },
    });
    const result = WritingEvaluationSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a band outside the 0-9 range", () => {
    const payload = validPayload({ estimated_task_band: 9.5 });
    const result = WritingEvaluationSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 3 next_band_actions", () => {
    const payload = validPayload({ next_band_actions: ["only one action"] });
    const result = WritingEvaluationSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("defaults inline_errors to an empty array when omitted", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).inline_errors;
    const result = WritingEvaluationSchema.parse(payload);
    expect(result.inline_errors).toEqual([]);
  });

  it("rejects a criterion with no evidence quotes", () => {
    const payload = validPayload({
      lexical_resource: { band: 6, evidence: [], why: "rationale text here" },
    });
    const result = WritingEvaluationSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
