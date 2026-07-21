import { describe, expect, it } from "vitest";
import { appendToWindow, computeErrorTrend, TREND_WINDOW } from "./errorTrend";

describe("computeErrorTrend", () => {
  it("returns PERSISTENT with fewer than 2 sessions of data", () => {
    expect(computeErrorTrend([])).toBe("PERSISTENT");
    expect(computeErrorTrend([4])).toBe("PERSISTENT");
  });

  it("returns IMPROVING when the error has disappeared entirely", () => {
    expect(computeErrorTrend([3, 2, 0, 0])).toBe("IMPROVING");
  });

  it("returns IMPROVING when occurrences have roughly halved", () => {
    expect(computeErrorTrend([4, 4, 2, 2])).toBe("IMPROVING");
  });

  it("returns WORSENING when occurrences have clearly grown", () => {
    expect(computeErrorTrend([1, 1, 3, 3])).toBe("WORSENING");
  });

  it("returns WORSENING when an error reappears after total absence", () => {
    expect(computeErrorTrend([0, 0, 2, 3])).toBe("WORSENING");
  });

  it("returns PERSISTENT for a stable rate", () => {
    expect(computeErrorTrend([2, 3, 2, 3])).toBe("PERSISTENT");
    expect(computeErrorTrend([2, 2, 2, 2, 2, 2])).toBe("PERSISTENT");
  });

  it("only looks at the trailing window, ignoring ancient history", () => {
    // Ancient bad counts followed by a long stable low rate: the window
    // only sees the recent stability.
    const counts = [9, 9, 1, 1, 1, 1, 1, 1];
    expect(computeErrorTrend(counts)).toBe("PERSISTENT");
  });
});

describe("appendToWindow", () => {
  it("appends and trims to the window size", () => {
    const start = [1, 2, 3, 4, 5, 6];
    expect(start).toHaveLength(TREND_WINDOW);
    expect(appendToWindow(start, 7)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("grows normally under the window size", () => {
    expect(appendToWindow([1], 0)).toEqual([1, 0]);
  });
});
