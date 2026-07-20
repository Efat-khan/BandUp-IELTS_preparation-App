import * as z from "zod";

/**
 * What the LLM is asked to produce. `expected_word_count` and
 * `time_limit_seconds` are NOT LLM-generated — Task 2 constants are
 * asserted in code (assembleQuestionContract) rather than trusted from
 * model output, per the "guardrails live in code" rule.
 */
export const QuestionGenerationLLMSchema = z.object({
  test_type: z.enum(["academic", "general"]),
  topic_tag: z.string().min(2).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prompt: z.string().min(40),
  instructions: z.string().min(10),
});

export type QuestionGenerationLLMOutput = z.infer<typeof QuestionGenerationLLMSchema>;

/** Public JSON contract (spec §5.3) returned by POST /api/questions/generate. */
export interface QuestionGenerationContract {
  skill: "writing";
  test_type: "academic" | "general";
  task: "task2";
  topic_tag: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  instructions: string;
  expected_word_count: 250;
  time_limit_seconds: 2400;
}

export function assembleQuestionContract(
  llmOutput: QuestionGenerationLLMOutput,
): QuestionGenerationContract {
  return {
    skill: "writing",
    task: "task2",
    test_type: llmOutput.test_type,
    topic_tag: llmOutput.topic_tag,
    difficulty: llmOutput.difficulty,
    prompt: llmOutput.prompt,
    instructions: llmOutput.instructions,
    expected_word_count: 250,
    time_limit_seconds: 2400,
  };
}
