/**
 * Official IELTS rounding rule, applied to an unrounded average:
 *   fractional part < 0.25          → round DOWN to the whole band
 *   0.25 <= fractional part < 0.75  → round to the half band (.5)
 *   fractional part >= 0.75         → round UP to the next whole band
 *
 * e.g. 6.125 → 6.0, 6.25 → 6.5, 6.74 → 6.5, 6.75 → 7.0
 *
 * This is a deterministic CODE guardrail — never delegated to the LLM.
 */

/** Tolerance for binary floating-point drift on exact .25/.75 boundaries. */
const EPSILON = 1e-9;

export function roundToIeltsBand(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error(`Cannot round non-finite score: ${score}`);
  }
  if (score < 0 || score > 9) {
    throw new Error(`Score out of IELTS range [0, 9]: ${score}`);
  }
  const whole = Math.floor(score);
  const frac = score - whole;
  if (frac < 0.25 - EPSILON) return whole;
  if (frac < 0.75 - EPSILON) return whole + 0.5;
  return whole + 1;
}
