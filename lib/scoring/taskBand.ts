import { roundToIeltsBand } from "./rounding";

export interface TaskBandResult {
  /** Exact average of the four criteria — authoritative, stored in the DB. */
  unrounded: number;
  /** Officially rounded band — the only value ever displayed. */
  band: number;
}

/**
 * A single Writing task's overall band: the four criteria are weighted
 * equally (unlike the two-task Writing module average in writingBand.ts,
 * which weights Task 2 double).
 */
export function combineTaskBand(
  taskResponse: number,
  coherenceCohesion: number,
  lexicalResource: number,
  grammaticalRangeAccuracy: number,
): TaskBandResult {
  const unrounded =
    (taskResponse + coherenceCohesion + lexicalResource + grammaticalRangeAccuracy) / 4;
  return { unrounded, band: roundToIeltsBand(unrounded) };
}
