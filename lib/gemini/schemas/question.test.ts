import { describe, expect, it } from "vitest";
import { assembleQuestionContract, QuestionGenerationLLMSchema } from "./question";

describe("QuestionGenerationLLMSchema", () => {
  it("accepts a well-formed LLM output", () => {
    const result = QuestionGenerationLLMSchema.safeParse({
      test_type: "academic",
      topic_tag: "automation and employment",
      difficulty: "medium",
      prompt: "Some people believe automation will destroy jobs. Discuss both views and give your opinion.",
      instructions: "You should spend about 40 minutes on this task and write at least 250 words.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid test_type", () => {
    const result = QuestionGenerationLLMSchema.safeParse({
      test_type: "ielts-general", // not "academic" | "general"
      topic_tag: "automation",
      difficulty: "medium",
      prompt: "Some people believe automation will destroy jobs. Discuss both views and give your opinion.",
      instructions: "Write at least 250 words.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a prompt that is too short to be a real Task 2 prompt", () => {
    const result = QuestionGenerationLLMSchema.safeParse({
      test_type: "academic",
      topic_tag: "automation",
      difficulty: "medium",
      prompt: "Discuss.",
      instructions: "Write at least 250 words.",
    });
    expect(result.success).toBe(false);
  });
});

describe("assembleQuestionContract", () => {
  it("asserts the fixed Task 2 constants rather than trusting the LLM for them", () => {
    const contract = assembleQuestionContract({
      test_type: "general",
      topic_tag: "remote work",
      difficulty: "easy",
      prompt: "Some people prefer working from home. Discuss the advantages and disadvantages.",
      instructions: "Write at least 250 words.",
    });
    expect(contract.skill).toBe("writing");
    expect(contract.task).toBe("task2");
    expect(contract.expected_word_count).toBe(250);
    expect(contract.time_limit_seconds).toBe(2400);
    expect(contract.test_type).toBe("general");
    expect(contract.topic_tag).toBe("remote work");
  });
});
