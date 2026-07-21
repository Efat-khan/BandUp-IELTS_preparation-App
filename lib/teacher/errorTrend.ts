export type ErrorTrendValue = "IMPROVING" | "PERSISTENT" | "WORSENING";

export const TREND_WINDOW = 6;

/**
 * Computes an error family's trend from its per-session occurrence counts
 * (newest last), in code — the LLM never guesses trends. Compares the
 * recent half of the window against the older half:
 * - gone entirely, or roughly halved → IMPROVING
 * - grown by ~40%+ → WORSENING
 * - otherwise (including <2 sessions of data) → PERSISTENT
 */
export function computeErrorTrend(recentCounts: number[]): ErrorTrendValue {
  const window = recentCounts.slice(-TREND_WINDOW);
  if (window.length < 2) return "PERSISTENT";

  const half = Math.floor(window.length / 2);
  const older = window.slice(0, window.length - half);
  const recent = window.slice(window.length - half);
  const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const olderAvg = avg(older);
  const recentAvg = avg(recent);

  if (recentAvg === 0 && olderAvg > 0) return "IMPROVING";
  if (olderAvg > 0 && recentAvg <= olderAvg * 0.6) return "IMPROVING";
  if (recentAvg > olderAvg && recentAvg >= olderAvg * 1.4) return "WORSENING";
  return "PERSISTENT";
}

/** Appends this session's count to the window, trimming to TREND_WINDOW. */
export function appendToWindow(recentCounts: number[], count: number): number[] {
  return [...recentCounts, count].slice(-TREND_WINDOW);
}
