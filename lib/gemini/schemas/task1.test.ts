import { describe, expect, it } from "vitest";
import { assembleTask1AcademicContract } from "./task1Academic";
import { assembleTask1GeneralContract } from "./task1General";

describe("assembleTask1AcademicContract", () => {
  it("asserts the fixed Task 1 constants (150 words / 1200 seconds)", () => {
    const contract = assembleTask1AcademicContract({
      topic_tag: "internet usage",
      difficulty: "medium",
      chart_spec: {
        type: "line",
        title: "Internet usage",
        xLabel: "Year",
        yLabel: "%",
        series: [{ name: "A", data: [{ x: "2000", y: 5 }, { x: "2020", y: 60 }] }],
      },
      prompt: "The chart below shows internet usage from 2000 to 2020.",
      instructions: "Write at least 150 words.",
    });
    expect(contract.skill).toBe("writing");
    expect(contract.task).toBe("task1");
    expect(contract.test_type).toBe("academic");
    expect(contract.expected_word_count).toBe(150);
    expect(contract.time_limit_seconds).toBe(1200);
    expect(contract.chart_spec.type).toBe("line");
  });
});

describe("assembleTask1GeneralContract", () => {
  it("assembles a letter prompt with the scenario and bullet points", () => {
    const contract = assembleTask1GeneralContract({
      register: "formal",
      topic_tag: "damaged product complaint",
      difficulty: "medium",
      scenario: "You recently bought a product online that arrived damaged.",
      bullet_points: [
        "explain what you bought and when",
        "describe the problem",
        "say what action you want them to take",
      ],
      instructions: "Write at least 150 words.",
    });
    expect(contract.skill).toBe("writing");
    expect(contract.task).toBe("task1");
    expect(contract.test_type).toBe("general");
    expect(contract.register).toBe("formal");
    expect(contract.expected_word_count).toBe(150);
    expect(contract.time_limit_seconds).toBe(1200);
    expect(contract.prompt).toContain("You recently bought a product online that arrived damaged.");
    expect(contract.prompt).toContain("- explain what you bought and when");
    expect(contract.prompt).toContain("- say what action you want them to take");
  });
});
