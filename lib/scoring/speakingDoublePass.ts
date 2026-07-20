import { scoreWithSchemaAndAudio } from "@/lib/gemini/client";
import {
  SPEAKING_CRITERION_KEYS,
  SpeakingEvaluationSchema,
  type SpeakingCriterionKey,
  type SpeakingEvaluation,
} from "@/lib/gemini/schemas/speakingEvaluation";

/** Same double-pass-at-temperature-0 + disagreement-flagging pattern as Writing (lib/scoring/doublePass.ts). */
export const DISAGREEMENT_TOLERANCE = 0.5;

export interface SpeakingCriterionDisagreement {
  criterion: SpeakingCriterionKey;
  pass1: number;
  pass2: number;
  delta: number;
}

export interface SpeakingDoublePassResult {
  pass1: SpeakingEvaluation;
  pass2: SpeakingEvaluation;
  canonicalBands: Record<SpeakingCriterionKey, number>;
  disagreementFlagged: boolean;
  disagreements: SpeakingCriterionDisagreement[];
}

export async function runSpeakingDoublePassScoring(
  systemPrompt: string,
  userPrompt: string,
  audio: { data: Buffer; mimeType: string } | null,
): Promise<SpeakingDoublePassResult> {
  const [pass1, pass2] = await Promise.all([
    scoreWithSchemaAndAudio(systemPrompt, userPrompt, audio, SpeakingEvaluationSchema),
    scoreWithSchemaAndAudio(systemPrompt, userPrompt, audio, SpeakingEvaluationSchema),
  ]);
  return combineSpeakingDoublePass(pass1, pass2);
}

/** Split out for testability without any Gemini calls. */
export function combineSpeakingDoublePass(
  pass1: SpeakingEvaluation,
  pass2: SpeakingEvaluation,
): SpeakingDoublePassResult {
  const canonicalBands = {} as Record<SpeakingCriterionKey, number>;
  const disagreements: SpeakingCriterionDisagreement[] = [];

  for (const key of SPEAKING_CRITERION_KEYS) {
    const b1 = pass1[key].band;
    const b2 = pass2[key].band;
    const delta = Math.abs(b1 - b2);
    canonicalBands[key] = (b1 + b2) / 2;
    if (delta > DISAGREEMENT_TOLERANCE) {
      disagreements.push({ criterion: key, pass1: b1, pass2: b2, delta });
    }
  }

  return {
    pass1,
    pass2,
    canonicalBands,
    disagreementFlagged: disagreements.length > 0,
    disagreements,
  };
}
