"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartRenderer } from "@/components/ChartRenderer";
import { EssayEditor } from "@/components/EssayEditor";
import { WritingResultsView, type WritingResult } from "@/components/WritingResultsView";
import type { ChartSpec } from "@/lib/gemini/schemas/chartSpec";

type TestType = "academic" | "general";

interface MockQuestion {
  id: string;
  test_type: TestType;
  topic_tag: string;
  difficulty: string;
  prompt: string;
  instructions: string;
  expected_word_count: number;
  chart_spec?: ChartSpec;
  register?: string;
}

interface MockStartResponse {
  sessionId: string;
  timeLimitSeconds: number;
  startedAt: string;
  task1: MockQuestion;
  task2: MockQuestion;
}

interface MockSubmitResponse {
  sessionId: string;
  overallUnrounded?: number;
  overallBand?: number;
  task1: WritingResult & { shortCircuitReason?: string };
  task2: WritingResult & { shortCircuitReason?: string };
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request to ${url} failed (${res.status})`);
  }
  return data;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function WritingMockPage() {
  const [task1TestType, setTask1TestType] = useState<TestType>("academic");
  const [session, setSession] = useState<MockStartResponse | null>(null);
  const [task1Text, setTask1Text] = useState("");
  const [task2Text, setTask2Text] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MockSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const task1WordCount = useMemo(() => countWords(task1Text), [task1Text]);
  const task2WordCount = useMemo(() => countWords(task2Text), [task2Text]);

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await postJson<MockSubmitResponse>("/api/mock/writing/submit", {
        sessionId: session.sessionId,
        task1Text,
        task2Text,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Keep a ref to the latest handleSubmit (with the latest typed text) so the
  // interval's auto-submit-on-timeout never fires with a stale closure.
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    if (!session || result) return;
    const deadline = new Date(session.startedAt).getTime() + session.timeLimitSeconds * 1000;
    let hasTriggeredSubmit = false;

    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !hasTriggeredSubmit) {
        hasTriggeredSubmit = true;
        void handleSubmitRef.current();
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [session, result]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    setResult(null);
    setSession(null);
    setTask1Text("");
    setTask2Text("");
    try {
      const data = await postJson<MockStartResponse>("/api/mock/writing/start", {
        task1TestType,
      });
      setSession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start mock");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Full Writing Mock
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Timed Task 1 + Task 2 (60 minutes), scored together for an overall Writing band.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {!session && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {(["academic", "general"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTask1TestType(t)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    task1TestType === t
                      ? "bg-foreground text-background"
                      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {t === "academic" ? "Academic" : "General Training"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="w-fit rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {starting ? "Starting…" : "Start 60-minute mock"}
            </button>
          </div>
        )}

        {session && !result && (
          <>
            <div className="sticky top-4 z-10 flex items-center justify-between rounded-lg border border-zinc-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Time remaining</span>
              <span
                className={`font-mono text-lg font-semibold ${
                  remainingSeconds !== null && remainingSeconds < 300
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {remainingSeconds !== null ? formatTime(remainingSeconds) : "--:--"}
              </span>
            </div>

            <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">
                Task 1 ({session.task1.test_type})
              </h2>
              {session.task1.chart_spec && <ChartRenderer spec={session.task1.chart_spec} />}
              <p className="whitespace-pre-line text-sm text-zinc-900 dark:text-zinc-100">
                {session.task1.prompt}
              </p>
              <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                {session.task1.instructions}
              </p>
              <EssayEditor
                key={`task1-${session.sessionId}`}
                value={task1Text}
                onChange={setTask1Text}
                editable
                placeholder="Write your Task 1 response here…"
              />
              <span
                className={
                  task1WordCount < session.task1.expected_word_count
                    ? "text-sm text-amber-600 dark:text-amber-400"
                    : "text-sm text-zinc-500 dark:text-zinc-400"
                }
              >
                {task1WordCount} / {session.task1.expected_word_count} words
              </span>
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Task 2</h2>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">{session.task2.prompt}</p>
              <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                {session.task2.instructions}
              </p>
              <EssayEditor
                key={`task2-${session.sessionId}`}
                value={task2Text}
                onChange={setTask2Text}
                editable
                placeholder="Write your Task 2 essay here…"
              />
              <span
                className={
                  task2WordCount < session.task2.expected_word_count
                    ? "text-sm text-amber-600 dark:text-amber-400"
                    : "text-sm text-zinc-500 dark:text-zinc-400"
                }
              >
                {task2WordCount} / {session.task2.expected_word_count} words
              </span>
            </section>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {submitting ? "Scoring…" : "Submit mock"}
            </button>
          </>
        )}

        {result && session && (
          <>
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Overall Writing band:{" "}
                {result.overallBand !== undefined ? result.overallBand.toFixed(1) : "—"}
              </h2>
              {result.overallUnrounded !== undefined && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  unrounded {result.overallUnrounded.toFixed(3)} — (Task 1 + 2×Task 2) / 3
                </p>
              )}
              {result.overallBand === undefined && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  One task could not be scored — see below.
                </p>
              )}
            </div>

            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Task 1</h2>
            {result.task1.criteria ? (
              <WritingResultsView
                title="Task 1 band"
                essayText={task1Text}
                questionPrompt={session.task1.prompt}
                result={result.task1}
              />
            ) : (
              <p className="text-sm text-red-700 dark:text-red-400">
                {result.task1.shortCircuitReason ?? "Task 1 could not be scored."}
              </p>
            )}

            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Task 2</h2>
            {result.task2.criteria ? (
              <WritingResultsView
                title="Task 2 band"
                essayText={task2Text}
                questionPrompt={session.task2.prompt}
                result={result.task2}
              />
            ) : (
              <p className="text-sm text-red-700 dark:text-red-400">
                {result.task2.shortCircuitReason ?? "Task 2 could not be scored."}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
