import { describe, expect, it } from "vitest";
import {
  buildPart1GeneratorSystemPrompt,
  buildPart2GeneratorSystemPrompt,
  buildPart3GeneratorSystemPrompt,
} from "./speakingGenerator";

/**
 * All three run through generate() with Search grounding ON (see
 * GEMINI_ROUTING.generation in lib/gemini/models.ts), so each must forbid
 * copying grounded search results verbatim into the generated question.
 */
describe("Speaking generator system prompts forbid verbatim copying from search grounding", () => {
  it("Part 1", () => {
    expect(buildPart1GeneratorSystemPrompt().toLowerCase()).toContain("verbatim");
  });

  it("Part 2", () => {
    expect(buildPart2GeneratorSystemPrompt().toLowerCase()).toContain("verbatim");
  });

  it("Part 3", () => {
    expect(buildPart3GeneratorSystemPrompt().toLowerCase()).toContain("verbatim");
  });
});
