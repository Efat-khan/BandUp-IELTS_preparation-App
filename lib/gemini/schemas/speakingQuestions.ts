import * as z from "zod";

/**
 * Speaking question generation contracts. Part 3 is generated FROM Part
 * 2's cue card (its follow-ups must extend that topic), so it is not
 * independent the way Part 1/Part 2 are — see lib/speaking/generateSpeakingSession.ts.
 */

const MIN_PART1_QUESTIONS = 8;
const MAX_PART1_QUESTIONS = 14;

export const Part1GenerationLLMSchema = z
  .object({
    topics: z
      .array(
        z.object({
          topic: z.string().min(2).max(60),
          questions: z.array(z.string().min(5)).min(3).max(5),
        }),
      )
      .min(2)
      .max(3),
    difficulty: z.enum(["easy", "medium", "hard"]),
  })
  .refine(
    (v) => {
      const total = v.topics.reduce((sum, t) => sum + t.questions.length, 0);
      return total >= MIN_PART1_QUESTIONS && total <= MAX_PART1_QUESTIONS;
    },
    { message: `Total questions across topics must be between ${MIN_PART1_QUESTIONS} and ${MAX_PART1_QUESTIONS}` },
  );

export type Part1GenerationLLMOutput = z.infer<typeof Part1GenerationLLMSchema>;

export interface Part1Contract {
  skill: "speaking";
  part: "part1";
  topics: Array<{ topic: string; questions: string[] }>;
  difficulty: "easy" | "medium" | "hard";
  instructions: string;
}

export function assemblePart1Contract(llmOutput: Part1GenerationLLMOutput): Part1Contract {
  return {
    skill: "speaking",
    part: "part1",
    topics: llmOutput.topics,
    difficulty: llmOutput.difficulty,
    instructions: "Answer each question naturally and briefly, as in a conversation.",
  };
}

export const Part2GenerationLLMSchema = z.object({
  topic_tag: z.string().min(2).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  /** e.g. "Describe a book you have recently read." */
  cue_card_topic: z.string().min(10),
  /** The "You should say:" bullet points. */
  bullet_points: z.array(z.string().min(3)).min(3).max(4),
  /** e.g. "and explain why you enjoyed it." */
  final_prompt: z.string().min(5),
});

export type Part2GenerationLLMOutput = z.infer<typeof Part2GenerationLLMSchema>;

export interface Part2Contract {
  skill: "speaking";
  part: "part2";
  topic_tag: string;
  difficulty: "easy" | "medium" | "hard";
  cue_card_topic: string;
  bullet_points: string[];
  final_prompt: string;
  prep_seconds: 60;
  speaking_seconds: 120;
  instructions: string;
}

export function assemblePart2Contract(llmOutput: Part2GenerationLLMOutput): Part2Contract {
  return {
    skill: "speaking",
    part: "part2",
    topic_tag: llmOutput.topic_tag,
    difficulty: llmOutput.difficulty,
    cue_card_topic: llmOutput.cue_card_topic,
    bullet_points: llmOutput.bullet_points,
    final_prompt: llmOutput.final_prompt,
    prep_seconds: 60,
    speaking_seconds: 120,
    instructions: "You have 1 minute to prepare, then speak for 1-2 minutes.",
  };
}

export const Part3GenerationLLMSchema = z.object({
  questions: z.array(z.string().min(10)).min(5).max(6),
});

export type Part3GenerationLLMOutput = z.infer<typeof Part3GenerationLLMSchema>;

export interface Part3Contract {
  skill: "speaking";
  part: "part3";
  questions: string[];
  instructions: string;
}

export function assemblePart3Contract(llmOutput: Part3GenerationLLMOutput): Part3Contract {
  return {
    skill: "speaking",
    part: "part3",
    questions: llmOutput.questions,
    instructions: "Discuss each question in more depth than Part 1 — these are general, not personal, questions.",
  };
}
