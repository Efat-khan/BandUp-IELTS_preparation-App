import * as z from "zod";
import { ChartSpecSchema, type ChartSpec } from "./chartSpec";

export const Task1AcademicGenerationLLMSchema = z.object({
  topic_tag: z.string().min(2).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  chart_spec: ChartSpecSchema,
  /** e.g. "The chart below shows ... Summarize the information by selecting and reporting the main features, and make comparisons where relevant." */
  prompt: z.string().min(20),
  instructions: z.string().min(10),
});

export type Task1AcademicGenerationLLMOutput = z.infer<typeof Task1AcademicGenerationLLMSchema>;

export interface Task1AcademicGenerationContract {
  skill: "writing";
  test_type: "academic";
  task: "task1";
  topic_tag: string;
  difficulty: "easy" | "medium" | "hard";
  chart_spec: ChartSpec;
  prompt: string;
  instructions: string;
  expected_word_count: 150;
  time_limit_seconds: 1200;
}

export function assembleTask1AcademicContract(
  llmOutput: Task1AcademicGenerationLLMOutput,
): Task1AcademicGenerationContract {
  return {
    skill: "writing",
    test_type: "academic",
    task: "task1",
    topic_tag: llmOutput.topic_tag,
    difficulty: llmOutput.difficulty,
    chart_spec: llmOutput.chart_spec,
    prompt: llmOutput.prompt,
    instructions: llmOutput.instructions,
    expected_word_count: 150,
    time_limit_seconds: 1200,
  };
}
