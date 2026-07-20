import { describe, expect, it } from "vitest";
import { extractAcousticFeatures, type TimestampedWord } from "./acousticFeatures";

function w(word: string, start: number, end: number, confidence = 0.9): TimestampedWord {
  return { word, start, end, confidence };
}

describe("extractAcousticFeatures", () => {
  it("returns all zeros for an empty transcript", () => {
    const result = extractAcousticFeatures([]);
    expect(result.totalWords).toBe(0);
    expect(result.speechRateWpm).toBe(0);
    expect(result.silentPauseCount).toBe(0);
    expect(result.meanLengthOfRun).toBe(0);
  });

  it("computes speech rate and treats contiguous speech as a single run", () => {
    const words = [
      w("This", 0, 0.3),
      w("is", 0.3, 0.5),
      w("a", 0.5, 0.6),
      w("fluent", 0.6, 1.0),
      w("sentence", 1.0, 1.6),
    ];
    const result = extractAcousticFeatures(words);
    expect(result.totalWords).toBe(5);
    expect(result.totalDurationSeconds).toBeCloseTo(1.6, 5);
    expect(result.speechRateWpm).toBeCloseTo((5 / 1.6) * 60, 1);
    expect(result.silentPauseCount).toBe(0);
    expect(result.meanLengthOfRun).toBe(5);
  });

  it("detects a silent pause > 0.5s and splits the run accordingly", () => {
    const words = [
      w("I", 0, 0.3),
      w("think", 0.3, 0.7),
      w("that", 1.7, 2.0), // 1.0s gap after "think" -> a silent pause
      w("is", 2.0, 2.2),
      w("good", 2.2, 2.5),
    ];
    const result = extractAcousticFeatures(words);
    expect(result.silentPauseCount).toBe(1);
    expect(result.totalSilentPauseSeconds).toBeCloseTo(1.0, 5);
    // runs of [2, 3] words either side of the pause
    expect(result.meanLengthOfRun).toBeCloseTo(2.5, 5);
    expect(result.speechRateWpm).toBeCloseTo((5 / 2.5) * 60, 1);
  });

  it("does not count a sub-threshold gap as a silent pause", () => {
    const words = [w("one", 0, 0.3), w("two", 0.6, 0.9)]; // 0.3s gap, under threshold
    const result = extractAcousticFeatures(words);
    expect(result.silentPauseCount).toBe(0);
    expect(result.meanLengthOfRun).toBe(2);
  });

  it("detects filler words case-insensitively", () => {
    const words = [w("Um", 0, 0.2), w("I", 0.2, 0.3), w("think", 0.3, 0.6), w("um", 0.6, 0.8), w("that", 0.8, 1.0)];
    const result = extractAcousticFeatures(words);
    expect(result.filledPauseCount).toBe(2);
    expect(result.filledPauseWords).toEqual(["Um", "um"]);
  });

  it("does not flag ambiguous words like 'like' as fillers", () => {
    const words = [w("I", 0, 0.2), w("like", 0.2, 0.4), w("apples", 0.4, 0.7)];
    const result = extractAcousticFeatures(words);
    expect(result.filledPauseCount).toBe(0);
  });

  it("counts self-corrections: immediate repetition, 'sorry', and 'I mean'", () => {
    const words = [
      w("I", 0, 0.2),
      w("I", 0.2, 0.4), // immediate repetition -> +1
      w("think", 0.4, 0.7),
      w("sorry", 0.7, 1.0), // -> +1
      w("I", 1.0, 1.2),
      w("mean", 1.2, 1.5), // "I mean" bigram -> +1
      w("yes", 1.5, 1.7),
    ];
    const result = extractAcousticFeatures(words);
    expect(result.selfCorrectionCount).toBe(3);
    expect(result.selfCorrectionRatePer100Words).toBeCloseTo((3 / 7) * 100, 1);
  });

  it("counts an immediate repeat of even a single-letter word (e.g. 'a a') as a self-correction", () => {
    const words = [w("a", 0, 0.1), w("a", 0.1, 0.2), w("cat", 0.2, 0.4)];
    const result = extractAcousticFeatures(words);
    expect(result.selfCorrectionCount).toBe(1);
  });

  it("averages word confidence", () => {
    const words = [w("a", 0, 0.1, 0.8), w("b", 0.1, 0.2, 1.0), w("c", 0.2, 0.3, 0.6)];
    const result = extractAcousticFeatures(words);
    expect(result.meanWordConfidence).toBeCloseTo(0.8, 5);
  });
});
