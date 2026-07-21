import { describe, expect, it } from "vitest";
import type { HumanizedFeedbackLLMOutput } from "@/lib/gemini/schemas/teacher";
import type { DbBands } from "./sessionFacts";
import { assertBandsUnchanged, BandIntegrityError, toHumanizedFeedback } from "./orchestrator";

/**
 * THE two-brains invariant: humanized feedback never alters a band from
 * the DB. The cold scorer owns every number; the warm teacher only
 * presents them.
 */

const dbBands: DbBands = {
  overallBand: 6.5,
  criterionBands: { TR: 6.5, CC: 7.0, LR: 6.5, GRA: 6.0 },
};

function llmOutput(overrides?: Partial<HumanizedFeedbackLLMOutput>): HumanizedFeedbackLLMOutput {
  return {
    greeting: "Good to see you back — third essay this week.",
    overall_band: 6.5,
    overall_comment: "This is a solid attempt with a clear position throughout the response.",
    criterion_comments: [
      { criterion: "TR", band: 6.5, comment: "You addressed both views and kept your opinion visible." },
      { criterion: "CC", band: 7.0, comment: "Your paragraphing carried the argument well this time." },
      { criterion: "LR", band: 6.5, comment: "Some precise choices, though a few repeated phrases remain." },
      { criterion: "GRA", band: 6.0, comment: "The article errors we have been tracking appeared again." },
    ],
    priority_action: "Before your next essay, do the articles micro-drill in your current unit.",
    encouragement: "Your CC has climbed half a band since the diagnostic — the structure work is paying off.",
    ...overrides,
  };
}

describe("assertBandsUnchanged (two-brains invariant)", () => {
  it("passes when every band matches the DB exactly", () => {
    expect(() => assertBandsUnchanged(llmOutput(), dbBands)).not.toThrow();
  });

  it("throws when the overall band was altered — even by half a band", () => {
    expect(() => assertBandsUnchanged(llmOutput({ overall_band: 7.0 }), dbBands)).toThrow(
      BandIntegrityError,
    );
  });

  it("throws when any criterion band was altered", () => {
    const tampered = llmOutput();
    tampered.criterion_comments = tampered.criterion_comments.map((c) =>
      c.criterion === "GRA" ? { ...c, band: 6.5 } : c,
    );
    expect(() => assertBandsUnchanged(tampered, dbBands)).toThrow(/altered GRA/);
  });

  it("throws when the humanizer drops a criterion", () => {
    const missing = llmOutput();
    missing.criterion_comments = missing.criterion_comments.filter((c) => c.criterion !== "LR");
    expect(() => assertBandsUnchanged(missing, dbBands)).toThrow(/dropped criterion LR/);
  });

  it("throws when the humanizer invents a criterion the scorer never scored", () => {
    const invented = llmOutput();
    invented.criterion_comments = [
      ...invented.criterion_comments,
      { criterion: "PR", band: 6.0, comment: "An invented pronunciation comment for an essay." },
    ];
    expect(() => assertBandsUnchanged(invented, dbBands)).toThrow(/invented criterion PR/);
  });

  it("throws when the submission has no band at all to present", () => {
    expect(() =>
      assertBandsUnchanged(llmOutput(), { overallBand: null, criterionBands: {} }),
    ).toThrow(/no overall band/);
  });
});

describe("toHumanizedFeedback", () => {
  it("re-stamps every band from the DB even after the assert passes", () => {
    const result = toHumanizedFeedback(llmOutput(), dbBands);
    expect(result.overallBand).toBe(dbBands.overallBand);
    for (const c of result.criterionComments) {
      expect(c.band).toBe(dbBands.criterionBands[c.criterion]);
    }
  });

  it("never returns output whose bands differ from the DB (tampered input is rejected, not passed through)", () => {
    expect(() => toHumanizedFeedback(llmOutput({ overall_band: 8.0 }), dbBands)).toThrow(
      BandIntegrityError,
    );
  });

  it("preserves the tutor's prose untouched", () => {
    const llm = llmOutput();
    const result = toHumanizedFeedback(llm, dbBands);
    expect(result.greeting).toBe(llm.greeting);
    expect(result.priorityAction).toBe(llm.priority_action);
    expect(result.encouragement).toBe(llm.encouragement);
  });
});
