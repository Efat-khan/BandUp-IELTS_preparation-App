import * as z from "zod";

export const Task1GeneralGenerationLLMSchema = z.object({
  register: z.enum(["formal", "semi_formal", "informal"]),
  topic_tag: z.string().min(2).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  /** The situational setup, e.g. "You recently bought a product online that arrived damaged." */
  scenario: z.string().min(20),
  /** The "In your letter: ..." required points — 3 or 4, as in the real exam. */
  bullet_points: z.array(z.string().min(3)).min(3).max(4),
  instructions: z.string().min(10),
});

export type Task1GeneralGenerationLLMOutput = z.infer<typeof Task1GeneralGenerationLLMSchema>;

export interface Task1GeneralGenerationContract {
  skill: "writing";
  test_type: "general";
  task: "task1";
  topic_tag: string;
  difficulty: "easy" | "medium" | "hard";
  register: "formal" | "semi_formal" | "informal";
  prompt: string;
  instructions: string;
  expected_word_count: 150;
  time_limit_seconds: 1200;
}

export function assembleTask1GeneralContract(
  llmOutput: Task1GeneralGenerationLLMOutput,
): Task1GeneralGenerationContract {
  const bulletList = llmOutput.bullet_points.map((point) => `- ${point}`).join("\n");
  const prompt = `${llmOutput.scenario}\n\nWrite a letter. In your letter:\n${bulletList}`;

  return {
    skill: "writing",
    test_type: "general",
    task: "task1",
    topic_tag: llmOutput.topic_tag,
    difficulty: llmOutput.difficulty,
    register: llmOutput.register,
    prompt,
    instructions: llmOutput.instructions,
    expected_word_count: 150,
    time_limit_seconds: 1200,
  };
}
