import { isFillerWord, SILENT_PAUSE_THRESHOLD_SECONDS } from "@/lib/speaking/acousticFeatures";
import type { TranscribedWord } from "@/lib/stt/transcribe";

interface FluencyTimelineProps {
  words: TranscribedWord[];
}

/** Overlays pauses (>0.5s) and filler words directly on the transcript. */
export function FluencyTimeline({ words }: FluencyTimelineProps) {
  if (words.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No transcript available.</p>;
  }

  const elements: React.ReactNode[] = [];
  words.forEach((w, i) => {
    const filler = isFillerWord(w.word);
    elements.push(
      <span
        key={`w-${i}`}
        className={filler ? "rounded bg-amber-200 px-0.5 dark:bg-amber-900" : undefined}
      >
        {w.word}{" "}
      </span>,
    );
    if (i < words.length - 1) {
      const gap = words[i + 1].start - w.end;
      if (gap > SILENT_PAUSE_THRESHOLD_SECONDS) {
        elements.push(
          <span
            key={`p-${i}`}
            className="mx-1 inline-block rounded-full bg-red-100 px-2 py-0.5 align-middle text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            ⏸ {gap.toFixed(1)}s
          </span>,
        );
      }
    }
  });

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 leading-8 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-200 dark:bg-amber-900" /> filler word
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-100 dark:bg-red-950" /> pause &gt;0.5s
        </span>
      </div>
      <p className="text-sm text-zinc-800 dark:text-zinc-200">{elements}</p>
    </div>
  );
}
