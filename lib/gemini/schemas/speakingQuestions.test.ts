import { describe, expect, it } from "vitest";
import {
  assemblePart1Contract,
  assemblePart2Contract,
  assemblePart3Contract,
  Part1GenerationLLMSchema,
} from "./speakingQuestions";

describe("Part1GenerationLLMSchema", () => {
  it("accepts 2-3 topics totaling 10-12 questions", () => {
    const result = Part1GenerationLLMSchema.safeParse({
      difficulty: "medium",
      topics: [
        { topic: "hometown", questions: ["Where is your hometown?", "What do you like about it?", "Has it changed much?"] },
        { topic: "hobbies", questions: ["What hobbies do you have?", "How did you start?", "Do you prefer indoor or outdoor hobbies?", "Would you like to try a new hobby?"] },
        { topic: "food", questions: ["What is your favourite food?", "Do you cook often?", "Did your food preferences change as a child?"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a total question count outside the tolerance range", () => {
    const result = Part1GenerationLLMSchema.safeParse({
      difficulty: "medium",
      topics: [{ topic: "hometown", questions: ["Q1?", "Q2?", "Q3?"] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("assemblePart1Contract", () => {
  it("assembles the speaking/part1 contract", () => {
    const contract = assemblePart1Contract({
      difficulty: "easy",
      topics: [{ topic: "hometown", questions: ["Q1?", "Q2?", "Q3?"] }],
    });
    expect(contract.skill).toBe("speaking");
    expect(contract.part).toBe("part1");
    expect(contract.topics).toHaveLength(1);
  });
});

describe("assemblePart2Contract", () => {
  it("asserts the fixed prep/speaking time constants", () => {
    const contract = assemblePart2Contract({
      topic_tag: "a memorable trip",
      difficulty: "medium",
      cue_card_topic: "Describe a trip you will never forget.",
      bullet_points: ["where you went", "who you went with", "what you did"],
      final_prompt: "and explain why it was memorable.",
    });
    expect(contract.part).toBe("part2");
    expect(contract.prep_seconds).toBe(60);
    expect(contract.speaking_seconds).toBe(120);
    expect(contract.bullet_points).toHaveLength(3);
  });
});

describe("assemblePart3Contract", () => {
  it("assembles the speaking/part3 contract", () => {
    const contract = assemblePart3Contract({
      questions: [
        "How do travel habits differ between generations?",
        "Is tourism generally beneficial for local economies?",
        "How might travel change in the future?",
        "Do people value experiences over possessions more than before?",
        "What are the drawbacks of frequent travel?",
      ],
    });
    expect(contract.part).toBe("part3");
    expect(contract.questions).toHaveLength(5);
  });
});
