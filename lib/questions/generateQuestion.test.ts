import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/generated/prisma/client";
import { reconstructWritingContract } from "./generateQuestion";

function makeQuestionRow(overrides: Partial<Question>): Question {
  return {
    id: "q1",
    module: "WRITING",
    taskType: "WRITING_TASK2",
    testType: "ACADEMIC",
    prompt: "Some prompt",
    imageUrl: null,
    topic: "technology",
    difficulty: "MEDIUM",
    instructions: "Some instructions",
    expectedWordCount: 250,
    timeLimitSeconds: 2400,
    chartSpec: null,
    letterRegister: null,
    part1Topics: null,
    cueCardPoints: null,
    prepSeconds: null,
    speakingSeconds: null,
    part3FollowUps: null,
    dedupeHash: "hash123",
    requestedByUserId: "original-requester",
    source: "GENERATED",
    modelId: "gemini-2.5-flash",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Question;
}

describe("reconstructWritingContract", () => {
  it("rebuilds a Task 2 contract faithfully from a persisted row", () => {
    const row = makeQuestionRow({
      taskType: "WRITING_TASK2",
      testType: "GENERAL",
      prompt: "Discuss both views and give your opinion.",
      topic: "remote work",
      difficulty: "HARD",
      instructions: "Write at least 250 words.",
    });
    const contract = reconstructWritingContract(row);
    expect(contract).toMatchObject({
      skill: "writing",
      task: "task2",
      test_type: "general",
      topic_tag: "remote work",
      difficulty: "hard",
      prompt: "Discuss both views and give your opinion.",
      instructions: "Write at least 250 words.",
      expected_word_count: 250,
      time_limit_seconds: 2400,
    });
  });

  it("rebuilds a Task 1 Academic contract including its chart_spec", () => {
    const chartSpec = { type: "bar", categories: ["A", "B"], series: [] };
    const row = makeQuestionRow({
      taskType: "WRITING_TASK1_ACADEMIC",
      testType: "ACADEMIC",
      chartSpec,
      difficulty: "EASY",
    });
    const contract = reconstructWritingContract(row);
    expect(contract).toMatchObject({
      skill: "writing",
      task: "task1",
      test_type: "academic",
      difficulty: "easy",
      expected_word_count: 150,
      time_limit_seconds: 1200,
    });
    expect((contract as { chart_spec: unknown }).chart_spec).toEqual(chartSpec);
  });

  it("rebuilds a Task 1 General contract with its register", () => {
    const row = makeQuestionRow({
      taskType: "WRITING_TASK1_GENERAL",
      testType: "GENERAL",
      letterRegister: "INFORMAL",
      difficulty: "MEDIUM",
    });
    const contract = reconstructWritingContract(row);
    expect(contract).toMatchObject({
      skill: "writing",
      task: "task1",
      test_type: "general",
      register: "informal",
      expected_word_count: 150,
      time_limit_seconds: 1200,
    });
  });

  it("falls back to empty strings for null topic/instructions rather than throwing", () => {
    const row = makeQuestionRow({ topic: null, instructions: null });
    const contract = reconstructWritingContract(row);
    expect(contract.topic_tag).toBe("");
    expect(contract.instructions).toBe("");
  });
});
