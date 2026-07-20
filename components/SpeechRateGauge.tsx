import { BAND7_TARGET_WPM } from "@/lib/speaking/acousticFeatures";

const GAUGE_MAX_WPM = 220;

/** Candidate's speech rate vs. the commonly-cited Band 7 target (~150 wpm). */
export function SpeechRateGauge({ wpm }: { wpm: number }) {
  const candidatePct = Math.min(100, (wpm / GAUGE_MAX_WPM) * 100);
  const targetPct = Math.min(100, (BAND7_TARGET_WPM / GAUGE_MAX_WPM) * 100);

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>Your speech rate: {wpm} wpm</span>
        <span>Band 7 target: ~{BAND7_TARGET_WPM} wpm</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div
          className="h-3 rounded-full bg-blue-500 transition-all"
          style={{ width: `${candidatePct}%` }}
        />
        <div
          className="absolute top-0 h-3 w-0.5 bg-zinc-900 dark:bg-zinc-100"
          style={{ left: `${targetPct}%` }}
          title={`Band 7 target: ${BAND7_TARGET_WPM} wpm`}
        />
      </div>
    </div>
  );
}
