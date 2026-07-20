import { describe, expect, it } from "vitest";
import {
  buildWritingEvaluatorUserPrompt,
  buildWritingTask1EvaluatorSystemPrompt,
  buildWritingTask2EvaluatorSystemPrompt,
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

describe("buildWritingTask1EvaluatorSystemPrompt", () => {
  it("uses Task Achievement (not Task Response) and the academic descriptor set", () => {
    const prompt = buildWritingTask1EvaluatorSystemPrompt("academic");
    expect(prompt).toContain("Task Achievement");
    expect(prompt).not.toContain("Task Response");
    expect(prompt.toLowerCase()).toContain("data");
    expect(prompt).toContain("Academic Task 1");
  });

  it("uses the general training descriptor set for general", () => {
    const prompt = buildWritingTask1EvaluatorSystemPrompt("general");
    expect(prompt).toContain("Task Achievement");
    expect(prompt.toLowerCase()).toContain("letter");
    expect(prompt).toContain("General Training Task 1");
  });

  it("still injects the shared CC/LR/GRA descriptors", () => {
    const prompt = buildWritingTask1EvaluatorSystemPrompt("academic");
    expect(prompt).toContain("Coherence and Cohesion");
    expect(prompt).toContain("Lexical Resource");
    expect(prompt).toContain("Grammatical Range and Accuracy");
  });
});

describe("buildWritingEvaluatorUserPrompt", () => {
  it("includes the prompt, instructions, essay, and pre-check notes", () => {
    const userPrompt = buildWritingEvaluatorUserPrompt({
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
    const userPrompt = buildWritingEvaluatorUserPrompt({
      questionPrompt: "Prompt",
      instructions: "Instructions",
      essayText: "Essay",
      preCheckNotes: [],
    });
    expect(userPrompt).not.toContain("Deterministic pre-check notes");
  });
});
