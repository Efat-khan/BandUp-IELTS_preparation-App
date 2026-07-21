import { describe, expect, it } from "vitest";
import {
  buildTask1AcademicGeneratorSystemPrompt,
  buildTask1GeneralGeneratorSystemPrompt,
  buildTask2GeneratorSystemPrompt,
} from "./generator";

/**
 * All three of these run through generate() with Search grounding ON (see
 * GEMINI_ROUTING.generation in lib/gemini/models.ts), so each must forbid
 * copying grounded search results verbatim into the generated prompt.
 */
describe("Writing generator system prompts forbid verbatim copying from search grounding", () => {
  it("Task 2", () => {
    expect(buildTask2GeneratorSystemPrompt().toLowerCase()).toContain("verbatim");
  });

  it("Task 1 Academic", () => {
    expect(buildTask1AcademicGeneratorSystemPrompt().toLowerCase()).toContain("verbatim");
  });

  it("Task 1 General", () => {
    expect(buildTask1GeneralGeneratorSystemPrompt().toLowerCase()).toContain("verbatim");
  });
});
