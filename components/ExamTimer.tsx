"use client";

import { useEffect, useRef, useState } from "react";

interface ExamTimerProps {
  /** The exam-accurate duration for this task, in seconds. */
  durationSeconds: number;
  /** Called exactly once, when the countdown reaches zero (never called while untimed). */
  onExpire: () => void;
  /** Server-provided start reference (e.g. a mock session's startedAt), for wall-clock accuracy across reloads. Defaults to mount time. */
  startedAt?: string | number | Date;
}

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(clamped % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Exam-accurate countdown with an untimed toggle. Pass a stable `key` (e.g.
 * the question/session id) from the parent so a new task gets a fresh timer
 * instance instead of trying to react to changing duration/startedAt props.
 */
export function ExamTimer({ durationSeconds, onExpire, startedAt }: ExamTimerProps) {
  const [untimed, setUntimed] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [startMs] = useState(() => (startedAt ? new Date(startedAt).getTime() : Date.now()));
  const deadlineMs = startMs + durationSeconds * 1000;
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.round((now - startMs) / 1000)));
      if (untimed) return;
      const remaining = Math.max(0, Math.round((deadlineMs - now) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [untimed, startMs, deadlineMs]);

  return (
    <div className="sticky top-4 z-10 flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={untimed}
          onChange={(e) => setUntimed(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Untimed practice
      </label>
      {untimed ? (
        <span className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {formatTime(elapsedSeconds)} elapsed
        </span>
      ) : (
        <span
          className={`font-mono text-lg font-semibold ${
            remainingSeconds < 300 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {formatTime(remainingSeconds)} remaining
        </span>
      )}
    </div>
  );
}
