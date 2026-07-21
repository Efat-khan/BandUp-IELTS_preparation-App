import { describe, expect, it } from "vitest";
import { buildCoachUserPrompt, TUTOR_SYSTEM_PROMPT, type TeacherContextBlock } from "./tutor";

const emptyContext: TeacherContextBlock = {
  learnerName: null,
  narrative: null,
  criterionEstimateLines: [],
  ledgerLines: [],
  activePlanUnitLine: null,
  lastSummary: null,
  targetBand: null,
  examDate: null,
};

describe("TUTOR_SYSTEM_PROMPT", () => {
  it("never lets the tutor re-score or negotiate a band", () => {
    expect(TUTOR_SYSTEM_PROMPT.toLowerCase()).toContain("never score, re-score, adjust, round");
  });

  it("instructs the tutor to acknowledge discouragement before giving a next step", () => {
    expect(TUTOR_SYSTEM_PROMPT.toLowerCase()).toContain("discouraged");
    expect(TUTOR_SYSTEM_PROMPT.toLowerCase()).toContain("one small, clearly winnable next step");
  });
});

describe("buildCoachUserPrompt", () => {
  it("instructs the reply to end with a next action or an inviting question", () => {
    const prompt = buildCoachUserPrompt(emptyContext, null, [], "How am I doing?");
    expect(prompt).toContain("End with either a specific next action or a question");
  });
});
