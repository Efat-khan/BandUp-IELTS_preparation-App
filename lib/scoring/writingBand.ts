import { roundToIeltsBand } from "./rounding";

export interface WritingBandResult {
  /** Exact weighted average — this is what gets STORED in the DB. */
  unrounded: number;
  /** Officially rounded band — this is the only value ever DISPLAYED. */
  band: number;
}

/**
 * Overall Writing band: Task 2 carries double weight.
 *   (task1 + 2 × task2) / 3, then the official rounding rule.
 */
export function combineWritingBand(
  task1: number,
  task2: number,
): WritingBandResult {
  const unrounded = (task1 + 2 * task2) / 3;
  return { unrounded, band: roundToIeltsBand(unrounded) };
}
