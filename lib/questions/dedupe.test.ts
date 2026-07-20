import { describe, expect, it } from "vitest";
import { computeQuestionDedupeHash, isDuplicateQuestion, normalizeForHash } from "./dedupe";

describe("normalizeForHash", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeForHash("Technology & Society!!  \n Discuss.")).toBe(
      "technology society discuss",
    );
  });
});

describe("computeQuestionDedupeHash", () => {
  it("is stable for identical input", () => {
    const a = computeQuestionDedupeHash("technology", "Discuss both views on automation.");
    const b = computeQuestionDedupeHash("technology", "Discuss both views on automation.");
    expect(a).toBe(b);
  });

  it("is unaffected by punctuation/case/whitespace-only rephrasing", () => {
    const a = computeQuestionDedupeHash("Technology", "Discuss both views on automation.");
    const b = computeQuestionDedupeHash("technology  ", "discuss BOTH views on automation");
    expect(a).toBe(b);
  });

  it("differs for genuinely different topics or prompts", () => {
    const a = computeQuestionDedupeHash("technology", "Discuss both views on automation.");
    const b = computeQuestionDedupeHash("environment", "Discuss both views on recycling.");
    expect(a).not.toBe(b);
  });
});

describe("isDuplicateQuestion", () => {
  it("detects a hash present in recent history", () => {
    const hash = computeQuestionDedupeHash("technology", "Discuss both views on automation.");
    expect(isDuplicateQuestion(hash, ["abc", hash, "def"])).toBe(true);
  });

  it("returns false when the hash isn't present", () => {
    const hash = computeQuestionDedupeHash("technology", "Discuss both views on automation.");
    expect(isDuplicateQuestion(hash, ["abc", "def"])).toBe(false);
  });
});
