import { describe, expect, it } from "vitest";
import {
  applyCalibrationCeiling,
  applyWordCountPenalty,
  MIN_TASK2_WORD_COUNT,
  runWritingPreChecks,
} from "./guardrails";

const SAMPLE_PROMPT =
  "Some people believe that automation and artificial intelligence will destroy more jobs than they create, while others believe new technology always generates new employment opportunities. Discuss both views and give your own opinion.";

function words(n: number, word = "technology"): string {
  return new Array(n).fill(word).join(" ");
}

describe("runWritingPreChecks", () => {
  it("flags empty answers", () => {
    const result = runWritingPreChecks(SAMPLE_PROMPT, "   ");
    expect(result.isEmpty).toBe(true);
    expect(result.wordCount).toBe(0);
    expect(result.meetsMinWordCount).toBe(false);
  });

  it("counts words and flags under the 250-word minimum", () => {
    const result = runWritingPreChecks(SAMPLE_PROMPT, words(100));
    expect(result.wordCount).toBe(100);
    expect(result.meetsMinWordCount).toBe(false);
    expect(result.notes.some((n) => n.includes("250-word minimum"))).toBe(true);
  });

  it("accepts answers at or above the minimum", () => {
    const result = runWritingPreChecks(SAMPLE_PROMPT, words(MIN_TASK2_WORD_COUNT));
    expect(result.meetsMinWordCount).toBe(true);
  });

  it("counts paragraphs by blank-line separation", () => {
    const text = "Intro paragraph here.\n\nBody paragraph one.\n\nBody paragraph two.\n\nConclusion here.";
    const result = runWritingPreChecks(SAMPLE_PROMPT, text);
    expect(result.paragraphCount).toBe(4);
  });

  it("flags essays with fewer than 3 paragraphs", () => {
    const result = runWritingPreChecks(SAMPLE_PROMPT, "Just one big wall of text with no breaks at all.");
    expect(result.paragraphCount).toBe(1);
    expect(result.notes.some((n) => n.includes("Fewer than 3 paragraphs"))).toBe(true);
  });

  it("detects keyboard-mashing gibberish", () => {
    const gibberish = new Array(60)
      .fill(0)
      .map((_, i) => "xkqz".repeat(1 + (i % 3)))
      .join(" ");
    const result = runWritingPreChecks(SAMPLE_PROMPT, gibberish);
    expect(result.isGibberish).toBe(true);
  });

  it("detects highly repetitive non-gibberish as low lexical diversity", () => {
    const repetitive = words(60, "yes");
    const result = runWritingPreChecks(SAMPLE_PROMPT, repetitive);
    expect(result.isGibberish).toBe(true);
  });

  it("does not flag a normal, on-topic essay as gibberish", () => {
    const essay = `
Automation and artificial intelligence are transforming labour markets worldwide.

While some argue that these technologies eliminate traditional jobs in manufacturing and administration, others contend that they simultaneously create new roles in software development, data analysis, and machine maintenance.

In my opinion, the net effect depends heavily on how governments invest in retraining programs and education, rather than on the technology itself.

To conclude, both views have merit, but proactive policy is what ultimately determines whether automation destroys or creates net employment.
`.trim();
    const result = runWritingPreChecks(SAMPLE_PROMPT, essay);
    expect(result.isGibberish).toBe(false);
  });

  it("flags off-topic essays with low overlap with the prompt", () => {
    const offTopicEssay = `
Growing your own vegetables at home has become an increasingly popular hobby in recent years.

Many gardeners start with simple crops such as tomatoes, lettuce and herbs before moving on to more demanding produce like peppers and squash.

Proper soil preparation, regular watering and adequate sunlight are the three factors that most determine whether a small garden thrives or fails.

Overall, home gardening offers a rewarding way to spend free time while also producing fresh, healthy food for the household.
`.trim();
    const result = runWritingPreChecks(SAMPLE_PROMPT, offTopicEssay);
    expect(result.isGibberish).toBe(false);
    expect(result.isOffTopic).toBe(true);
  });

  it("does not flag off-topic when gibberish already applies", () => {
    const gibberish = new Array(60)
      .fill(0)
      .map((_, i) => "xkqz".repeat(1 + (i % 3)))
      .join(" ");
    const result = runWritingPreChecks(SAMPLE_PROMPT, gibberish);
    expect(result.isOffTopic).toBe(false);
  });

  it("detects memorized-template phrases", () => {
    const templated = "It is a widely believed fact that technology changes society. " + words(240);
    const result = runWritingPreChecks(SAMPLE_PROMPT, templated);
    expect(result.templatePhrasesDetected.length).toBeGreaterThan(0);
  });
});

describe("applyWordCountPenalty", () => {
  it("does not cap when the minimum word count is met", () => {
    expect(applyWordCountPenalty(8, true)).toEqual({ band: 8, applied: false });
  });

  it("caps Task Response at 6 when under the minimum and the raw band exceeds 6", () => {
    expect(applyWordCountPenalty(7.5, false)).toEqual({ band: 6, applied: true });
  });

  it("does not raise the band when it's already at or below the cap", () => {
    expect(applyWordCountPenalty(5, false)).toEqual({ band: 5, applied: false });
    expect(applyWordCountPenalty(6, false)).toEqual({ band: 6, applied: false });
  });
});

describe("applyCalibrationCeiling", () => {
  it("defaults to a no-op ceiling of 9 for every criterion", () => {
    expect(applyCalibrationCeiling("TR", 9)).toEqual({ band: 9, clamped: false });
    expect(applyCalibrationCeiling("GRA", 8.5)).toEqual({ band: 8.5, clamped: false });
  });
});
