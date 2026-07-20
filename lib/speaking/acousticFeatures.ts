/**
 * Acoustic feature extraction from STT word-level timestamps (spec §7.1
 * Step 2). Pure code, deterministic, no external API — these numbers are
 * computed here and injected into the Speaking evaluator's prompt as
 * ground truth (see lib/prompts/speakingEvaluator.ts), never re-derived
 * or guessed by the LLM.
 */

export interface TimestampedWord {
  word: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
  /** 0-1, from the STT provider. */
  confidence: number;
}

export interface AcousticFeatures {
  totalWords: number;
  totalDurationSeconds: number;
  speechRateWpm: number;
  filledPauseCount: number;
  filledPauseWords: string[];
  /** Pauses strictly greater than SILENT_PAUSE_THRESHOLD_SECONDS. */
  silentPauseCount: number;
  totalSilentPauseSeconds: number;
  /** Average number of words spoken between silent pauses — a fluency proxy. */
  meanLengthOfRun: number;
  selfCorrectionCount: number;
  selfCorrectionRatePer100Words: number;
  meanWordConfidence: number;
}

export const SILENT_PAUSE_THRESHOLD_SECONDS = 0.5;

/** Single-token filler words only — ambiguous words like "like" (can be a real verb) are deliberately excluded to avoid false positives. */
const FILLER_WORDS = new Set(["um", "uh", "erm", "er", "hmm", "uhh", "umm"]);

/** Exported so the fluency timeline UI highlights exactly the same words this module counts as fillers. */
export function isFillerWord(word: string): boolean {
  return FILLER_WORDS.has(normalize(word));
}

const EMPTY_FEATURES: AcousticFeatures = {
  totalWords: 0,
  totalDurationSeconds: 0,
  speechRateWpm: 0,
  filledPauseCount: 0,
  filledPauseWords: [],
  silentPauseCount: 0,
  totalSilentPauseSeconds: 0,
  meanLengthOfRun: 0,
  selfCorrectionCount: 0,
  selfCorrectionRatePer100Words: 0,
  meanWordConfidence: 0,
};

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function extractAcousticFeatures(words: TimestampedWord[]): AcousticFeatures {
  if (words.length === 0) return { ...EMPTY_FEATURES };

  const totalDurationSeconds = Math.max(0, words[words.length - 1].end - words[0].start);
  const totalWords = words.length;
  const speechRateWpm = totalDurationSeconds > 0 ? (totalWords / totalDurationSeconds) * 60 : 0;

  const filledPauseWords: string[] = [];
  for (const w of words) {
    if (FILLER_WORDS.has(normalize(w.word))) filledPauseWords.push(w.word);
  }

  let silentPauseCount = 0;
  let totalSilentPauseSeconds = 0;
  const runLengths: number[] = [];
  let currentRun = 1;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > SILENT_PAUSE_THRESHOLD_SECONDS) {
      silentPauseCount++;
      totalSilentPauseSeconds += gap;
      runLengths.push(currentRun);
      currentRun = 1;
    } else {
      currentRun++;
    }
  }
  runLengths.push(currentRun);
  const meanLengthOfRun = runLengths.reduce((a, b) => a + b, 0) / runLengths.length;

  let selfCorrectionCount = 0;
  for (let i = 1; i < words.length; i++) {
    const prev = normalize(words[i - 1].word);
    const curr = normalize(words[i].word);
    if (prev.length > 0 && prev === curr) selfCorrectionCount++;
  }
  for (const w of words) {
    if (normalize(w.word) === "sorry") selfCorrectionCount++;
  }
  for (let i = 0; i < words.length - 1; i++) {
    if (normalize(words[i].word) === "i" && normalize(words[i + 1].word) === "mean") {
      selfCorrectionCount++;
    }
  }

  const meanWordConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / totalWords;

  return {
    totalWords,
    totalDurationSeconds: round(totalDurationSeconds, 2),
    speechRateWpm: round(speechRateWpm, 1),
    filledPauseCount: filledPauseWords.length,
    filledPauseWords,
    silentPauseCount,
    totalSilentPauseSeconds: round(totalSilentPauseSeconds, 2),
    meanLengthOfRun: round(meanLengthOfRun, 2),
    selfCorrectionCount,
    selfCorrectionRatePer100Words: round((selfCorrectionCount / totalWords) * 100, 2),
    meanWordConfidence: round(meanWordConfidence, 3),
  };
}

/** Band-7 speech rate is a commonly cited target (~150 wpm) for the UI's speech-rate gauge. */
export const BAND7_TARGET_WPM = 150;

/** Human-readable summary injected into the evaluator prompt as ground truth. */
export function formatAcousticFeaturesSummary(features: AcousticFeatures, label: string): string {
  return `${label}: ${features.totalWords} words over ${features.totalDurationSeconds}s \
(${features.speechRateWpm} wpm). Filled pauses: ${features.filledPauseCount}. Silent pauses \
>0.5s: ${features.silentPauseCount} (totaling ${features.totalSilentPauseSeconds}s). Mean \
length of run between pauses: ${features.meanLengthOfRun} words. Self-corrections: \
${features.selfCorrectionCount} (${features.selfCorrectionRatePer100Words} per 100 words). \
Mean STT word confidence: ${features.meanWordConfidence}.`;
}
