/**
 * Speech-to-text abstraction. Deepgram is the concrete provider (word-level
 * timestamps + confidence per word, matching the "STT engine returning
 * word-level timestamps + confidence" requirement) — swappable for
 * Whisper/AssemblyAI behind this same interface without touching callers.
 */

export interface TranscribedWord {
  word: string;
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  /** 0-1. */
  confidence: number;
}

export interface TranscriptionResult {
  transcript: string;
  words: TranscribedWord[];
  durationSeconds: number;
}

export interface SttProvider {
  transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult>;
}

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        words?: DeepgramWord[];
      }>;
    }>;
  };
}

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen";

export class DeepgramProvider implements SttProvider {
  async transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not set");
    }

    const response = await fetch(
      `${DEEPGRAM_API_URL}?model=nova-2&smart_format=true&punctuate=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": mimeType,
        },
        body: new Uint8Array(audio),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Deepgram transcription failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as DeepgramResponse;
    const alternative = data.results?.channels?.[0]?.alternatives?.[0];
    if (!alternative) {
      throw new Error("Deepgram response is missing the expected transcript data");
    }

    const words: TranscribedWord[] = (alternative.words ?? []).map((w) => ({
      word: w.punctuated_word ?? w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
    }));
    const durationSeconds = words.length > 0 ? words[words.length - 1].end : 0;

    return { transcript: alternative.transcript ?? "", words, durationSeconds };
  }
}

export function getSttProvider(): SttProvider {
  return new DeepgramProvider();
}
