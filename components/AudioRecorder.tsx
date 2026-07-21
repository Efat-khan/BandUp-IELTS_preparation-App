"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "prep" | "recording" | "done" | "error";

interface AudioRecorderProps {
  /** Shows a countdown prep phase before recording starts (Part 2 only). */
  prepSeconds?: number;
  /** Recording auto-stops at this many seconds (Part 2 only, typically). */
  maxSpeakingSeconds?: number;
  onRecordingComplete: (audioBlob: Blob, mimeType: string) => void;
  disabled?: boolean;
}

function pickSupportedMimeType(): string {
  const candidates = ["audio/webm", "audio/ogg", "audio/mp4"];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "audio/webm";
}

export function AudioRecorder({
  prepSeconds,
  maxSpeakingSeconds,
  onRecordingComplete,
  disabled,
}: AudioRecorderProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [untimed, setUntimed] = useState(false);
  const [prepRemaining, setPrepRemaining] = useState(prepSeconds ?? 0);
  const [speakingElapsed, setSpeakingElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const effectivePrepSeconds = untimed ? 0 : prepSeconds;
  const effectiveMaxSpeakingSeconds = untimed ? undefined : maxSpeakingSeconds;
  const hasTimedControls = Boolean(prepSeconds || maxSpeakingSeconds);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function beginRecording(stream: MediaStream) {
    chunksRef.current = [];
    const mimeType = pickSupportedMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onRecordingComplete(blob, mimeType);
      setPhase("done");
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setSpeakingElapsed(0);
    setPhase("recording");
  }

  async function startFlow() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (effectivePrepSeconds && effectivePrepSeconds > 0) {
        setPrepRemaining(effectivePrepSeconds);
        setPhase("prep");
      } else {
        beginRecording(stream);
      }
    } catch {
      setError("Could not access the microphone. Check your browser permissions.");
      setPhase("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  useEffect(() => {
    if (phase !== "prep") return;
    if (prepRemaining <= 0) {
      if (streamRef.current) beginRecording(streamRef.current);
      return;
    }
    const timeout = setTimeout(() => setPrepRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, prepRemaining]);

  useEffect(() => {
    if (phase !== "recording") return;
    if (effectiveMaxSpeakingSeconds && speakingElapsed >= effectiveMaxSpeakingSeconds) {
      stopRecording();
      return;
    }
    const timeout = setTimeout(() => setSpeakingElapsed((s) => s + 1), 1000);
    return () => clearTimeout(timeout);
  }, [phase, speakingElapsed, effectiveMaxSpeakingSeconds]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {hasTimedControls && phase === "idle" && (
        <label className="flex w-fit items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={untimed}
            onChange={(e) => setUntimed(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Untimed practice (skip prep countdown, no auto-stop)
        </label>
      )}
      {phase === "idle" && (
        <button
          type="button"
          onClick={startFlow}
          disabled={disabled}
          className="w-fit rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Start recording
        </button>
      )}
      {phase === "prep" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Preparation time: <span className="font-mono font-semibold">{prepRemaining}s</span> remaining
        </div>
      )}
      {phase === "recording" && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600 dark:bg-red-400" />
            Recording… {speakingElapsed}s
            {effectiveMaxSpeakingSeconds ? ` / ${effectiveMaxSpeakingSeconds}s` : ""}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Stop recording
          </button>
        </div>
      )}
      {phase === "done" && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Recorded ✓</p>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
