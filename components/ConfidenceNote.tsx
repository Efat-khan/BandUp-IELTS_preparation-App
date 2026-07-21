/** Shown next to every AI-produced band so the estimate is never mistaken for an official score. */
export function ConfidenceNote({ className }: { className?: string }) {
  return (
    <p className={className ?? "mt-1 text-xs text-zinc-500 dark:text-zinc-400"}>
      AI estimate — typically within half a band of an official examiner.
    </p>
  );
}
