import { describe, expect, it } from "vitest";
import {
  buildWritingTask2EvaluatorSystemPrompt,
  buildWritingTask2EvaluatorUserPrompt,
} from "./evaluator";

describe("buildWritingTask2EvaluatorSystemPrompt", () => {
  it("injects all four criteria's official band descriptors", () => {
    const prompt = buildWritingTask2EvaluatorSystemPrompt();
    expect(prompt).toContain("Task Response");
    expect(prompt).toContain("Coherence and Cohesion");
    expect(prompt).toContain("Lexical Resource");
    expect(prompt).toContain("Grammatical Range and Accuracy");
    expect(prompt).toContain("Band 9");
    expect(prompt).toContain("Band 5");
  });

  it("instructs the model to quote evidence verbatim and use structured output only", () => {
    const prompt = buildWritingTask2EvaluatorSystemPrompt();
    expect(prompt.toLowerCase()).toContain("verbatim");
    expect(prompt).toContain("ONLY the structured JSON");
  });
});

describe("buildWritingTask2EvaluatorUserPrompt", () => {
  it("includes the prompt, instructions, essay, and pre-check notes", () => {
    const userPrompt = buildWritingTask2EvaluatorUserPrompt({
      questionPrompt: "Discuss both views on automation.",
      instructions: "Write at least 250 words.",
      essayText: "My essay text goes here.",
      preCheckNotes: ["Word count: 260 (minimum required: 250)."],
    });
    expect(userPrompt).toContain("Discuss both views on automation.");
    expect(userPrompt).toContain("Write at least 250 words.");
    expect(userPrompt).toContain("My essay text goes here.");
    expect(userPrompt).toContain("Word count: 260");
  });

  it("omits the pre-check section entirely when there are no notes", () => {
    const userPrompt = buildWritingTask2EvaluatorUserPrompt({
      questionPrompt: "Prompt",
      instructions: "Instructions",
      essayText: "Essay",
      preCheckNotes: [],
    });
    expect(userPrompt).not.toContain("Deterministic pre-check notes");
  });
});
