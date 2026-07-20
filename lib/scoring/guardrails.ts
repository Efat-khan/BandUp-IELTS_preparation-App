/**
 * Deterministic scoring guardrails (spec §6.1 Step 1 pre-checks, plus
 * post-process guardrails). These run in CODE, never delegated to the LLM:
 * - word count, empty/gibberish/off-topic, paragraph count, memorized
 *   templates (pre-checks, computed before any scoring call)
 * - the word-count primary-criterion cap and the calibration ceiling clamp
 *   (post-process, applied to the LLM's own criterion bands)
 */

/** TR (Task Response, Task 2) and TA (Task Achievement, Task 1) share the same guardrail mechanics. */
export type ScoredCriterionId = "TR" | "TA" | "CC" | "LR" | "GRA";

export const MIN_TASK2_WORD_COUNT = 250;
export const MIN_TASK1_WORD_COUNT = 150;
export const WORD_COUNT_TR_CAP = 6;

/** Below this many words, gibberish detection is unreliable — the word-count guardrail already covers short answers. */
const MIN_WORDS_FOR_GIBBERISH_CHECK = 15;
/** Below this overlap fraction with the prompt's content words, flag off-topic. */
const OFF_TOPIC_OVERLAP_THRESHOLD = 0.15;
const MIN_PARAGRAPHS = 3;

const STOPWORDS = new Set([
  "about", "after", "again", "against", "all", "also", "although", "always",
  "among", "another", "any", "around", "because", "before", "being", "between",
  "could", "does", "doing", "during", "each", "either", "every",
  "first", "from", "further", "having", "however", "into", "itself", "many",
  "might", "more", "most", "much", "must", "myself", "never", "often", "other",
  "others", "ought", "over", "people", "should", "since", "some", "still",
  "such", "than", "that", "their", "them", "then", "there", "these", "they",
  "this", "those", "through", "under", "until", "very", "were", "what",
  "when", "where", "which", "while", "with", "would",
]);

const MEMORIZED_TEMPLATE_PHRASES = [
  "it is a widely believed fact that",
  "there are several reasons for this which i will explore",
  "in today's modern society",
  "in the modern world",
  "first and foremost",
  "last but not least",
  "to conclude, in my opinion",
  "this essay will discuss both views and give my own opinion",
  "on the other hand, some people believe that",
  "in conclusion, it is clear that there are both advantages and disadvantages",
];

export interface WritingPreCheckResult {
  wordCount: number;
  meetsMinWordCount: boolean;
  paragraphCount: number;
  isEmpty: boolean;
  isGibberish: boolean;
  isOffTopic: boolean;
  templatePhrasesDetected: string[];
  /** Human-readable notes injected into the evaluator's user prompt as ground truth. */
  notes: string[];
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function countParagraphs(text: string): number {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

function extractContentWords(text: string): Set<string> {
  return new Set(
    tokenize(text).filter((w) => w.length >= 5 && !STOPWORDS.has(w)),
  );
}

function detectGibberish(words: string[]): boolean {
  if (words.length < MIN_WORDS_FOR_GIBBERISH_CHECK) return false;
  const withVowel = words.filter((w) => /[aeiou]/.test(w)).length;
  const vowelRatio = withVowel / words.length;
  const uniqueRatio = new Set(words).size / words.length;
  return vowelRatio < 0.6 || uniqueRatio < 0.3;
}

function detectOffTopic(promptText: string, essayText: string): boolean {
  const promptWords = extractContentWords(promptText);
  if (promptWords.size === 0) return false;
  const essayWords = extractContentWords(essayText);
  let overlap = 0;
  for (const w of promptWords) if (essayWords.has(w)) overlap++;
  return overlap / promptWords.size < OFF_TOPIC_OVERLAP_THRESHOLD;
}

function detectTemplatePhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return MEMORIZED_TEMPLATE_PHRASES.filter((phrase) => lower.includes(phrase));
}

export function runWritingPreChecks(
  promptText: string,
  essayText: string,
  minWordCount: number = MIN_TASK2_WORD_COUNT,
): WritingPreCheckResult {
  const trimmed = essayText.trim();
  const wordCount = countWords(trimmed);
  const isEmpty = wordCount === 0;
  const words = tokenize(trimmed);
  const paragraphCount = countParagraphs(trimmed);
  const isGibberish = !isEmpty && detectGibberish(words);
  const isOffTopic = !isEmpty && !isGibberish && detectOffTopic(promptText, trimmed);
  const templatePhrasesDetected = isEmpty ? [] : detectTemplatePhrases(trimmed);

  const notes: string[] = [`Word count: ${wordCount} (minimum required: ${minWordCount}).`];
  if (wordCount < minWordCount) {
    notes.push(
      `Below the ${minWordCount}-word minimum — a Task Achievement/Response penalty is applied in code regardless of the band you assign.`,
    );
  }
  notes.push(`Paragraph count: ${paragraphCount}.`);
  if (paragraphCount < MIN_PARAGRAPHS) {
    notes.push(
      `Fewer than ${MIN_PARAGRAPHS} paragraphs detected — factor this into Coherence & Cohesion.`,
    );
  }
  if (isOffTopic) {
    notes.push(
      "Automated heuristic flagged low lexical overlap with the prompt — verify whether the essay actually addresses the task.",
    );
  }
  if (templatePhrasesDetected.length > 0) {
    notes.push(
      `Detected ${templatePhrasesDetected.length} common memorized-template phrase(s) — treat generic templated language as a weakness, not genuine development.`,
    );
  }

  return {
    wordCount,
    meetsMinWordCount: wordCount >= MIN_TASK2_WORD_COUNT,
    paragraphCount,
    isEmpty,
    isGibberish,
    isOffTopic,
    templatePhrasesDetected,
    notes,
  };
}

/**
 * Under-length answers get their primary criterion (TR for Task 2, TA for
 * Task 1) capped in CODE — the LLM's own band is never trusted to apply
 * this on its own.
 */
export function applyWordCountPenalty(
  primaryCriterionBand: number,
  meetsMinWordCount: boolean,
): { band: number; applied: boolean } {
  if (meetsMinWordCount || primaryCriterionBand <= WORD_COUNT_TR_CAP) {
    return { band: primaryCriterionBand, applied: false };
  }
  return { band: WORD_COUNT_TR_CAP, applied: true };
}

/**
 * Ceiling per criterion above which the LLM's band is clamped. Defaults to
 * 9 (a no-op) for every criterion: there is no real gold-set evidence yet
 * of systematic over-scoring at any particular band. Once
 * scripts/calibrate.ts has run against real official-band essays and shown
 * a drift pattern (e.g. the model over-awarding 9s), tighten the relevant
 * entry here — that report is what should justify any non-default value,
 * not a guess made ahead of the data.
 */
export const CALIBRATION_CEILING: Record<ScoredCriterionId, number> = {
  TR: 9,
  TA: 9,
  CC: 9,
  LR: 9,
  GRA: 9,
};

export function applyCalibrationCeiling(
  criterion: ScoredCriterionId,
  band: number,
): { band: number; clamped: boolean } {
  const ceiling = CALIBRATION_CEILING[criterion];
  if (band > ceiling) return { band: ceiling, clamped: true };
  return { band, clamped: false };
}
