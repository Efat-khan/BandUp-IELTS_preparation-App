/**
 * Pronunciation scoring: if a real phoneme-level pronunciation API (e.g.
 * Azure Pronunciation Assessment) is configured, use its score and mark
 * it "measured"; otherwise fall back to the LLM's own audio-informed PR
 * band from the evaluator's structured output and mark it "estimated".
 *
 * The Azure integration itself is a stub — no AZURE_SPEECH_KEY is in
 * scope for this phase — but the interface is real so it can be wired in
 * without touching any caller.
 */

export type PronunciationSource = "MEASURED" | "ESTIMATED";

export interface PronunciationResult {
  source: PronunciationSource;
  band: number;
}

interface PronunciationAssessment {
  band: number;
}

interface PronunciationProvider {
  assess(audio: Buffer, mimeType: string, referenceText: string): Promise<PronunciationAssessment>;
}

class AzurePronunciationAssessmentProvider implements PronunciationProvider {
  async assess(audio: Buffer, mimeType: string, referenceText: string): Promise<PronunciationAssessment> {
    const apiKey = process.env.AZURE_SPEECH_KEY;
    if (!apiKey) {
      throw new Error("AZURE_SPEECH_KEY is not set");
    }
    // Azure's Pronunciation Assessment API returns 0-100 accuracy/fluency/
    // completeness scores that would be mapped onto the 1-9 band scale
    // here. Not implemented — no Azure Speech key is in scope for this
    // phase; this stub exists so the "measured" path is real to wire in.
    throw new Error(
      `Azure Pronunciation Assessment integration is not implemented (received ${audio.length}-byte ${mimeType} audio, reference text length ${referenceText.length})`,
    );
  }
}

export function isPronunciationApiConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY);
}

export async function resolvePronunciationBand(input: {
  /** The evaluator's own PR band from the structured output — the estimated fallback. */
  llmPronunciationBand: number;
  audio?: { data: Buffer; mimeType: string };
  referenceText: string;
}): Promise<PronunciationResult> {
  if (isPronunciationApiConfigured() && input.audio) {
    try {
      const provider = new AzurePronunciationAssessmentProvider();
      const assessment = await provider.assess(input.audio.data, input.audio.mimeType, input.referenceText);
      return { source: "MEASURED", band: assessment.band };
    } catch {
      // Configured but the call failed — fall through to the estimate
      // rather than blocking the whole evaluation on a secondary signal.
    }
  }
  return { source: "ESTIMATED", band: input.llmPronunciationBand };
}
