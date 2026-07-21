"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EssayEditor } from "@/components/EssayEditor";
import { ExamTimer } from "@/components/ExamTimer";
import { SpeakingDrillFlow, type DrillQuestion } from "@/components/SpeakingDrillFlow";
import type { QuestionGenerationContract } from "@/lib/gemini/schemas/question";

interface DiagnosticQuestion extends QuestionGenerationContract {
  id: string;
}

interface DiagnosticStartResponse {
  writing: DiagnosticQuestion;
  speaking: DrillQuestion;
}

interface WritingEvalResponse {
  submissionId: string;
  status: string;
  overallBand?: number;
}

const TASK2_DURATION_SECONDS = 40 * 60;

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
  if (!res.ok) throw new Error(data.error ?? `Request to ${url} failed (${res.status})`);
  return data;
}

export default function DiagnosticPage() {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DiagnosticStartResponse | null>(null);

  const [essay, setEssay] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [writingSubmissionId, setWritingSubmissionId] = useState<string | null>(null);
  const [writingBand, setWritingBand] = useState<number | null>(null);

  const [speakingSubmissionId, setSpeakingSubmissionId] = useState<string | null>(null);

  const [finishing, setFinishing] = useState(false);
  const [debrief, setDebrief] = useState<string | null>(null);

  const wordCount = useMemo(() => countWords(essay), [essay]);
  const bothDone = Boolean(writingSubmissionId && speakingSubmissionId);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const data = await postJson<DiagnosticStartResponse>("/api/diagnostic/start", {});
      setQuestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start the diagnostic");
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmitEssay() {
    if (!questions) return;
    setEvaluating(true);
    setError(null);
    try {
      const data = await postJson<WritingEvalResponse>("/api/evaluate/writing", {
        questionId: questions.writing.id,
        text: essay,
      });
      setWritingSubmissionId(data.submissionId);
      setWritingBand(data.overallBand ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  async function handleFinish() {
    if (!writingSubmissionId || !speakingSubmissionId) return;
    setFinishing(true);
    setError(null);
    try {
      const data = await postJson<{ debrief: string; planId: string }>("/api/diagnostic/complete", {
        writingSubmissionId,
        speakingSubmissionId,
      });
      setDebrief(data.debrief);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete the diagnostic");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Your Diagnostic Session
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            One Writing Task 2 essay and one Speaking long turn. Your tutor uses both to build
            your first study plan.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {!questions && !debrief && (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="w-fit rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {starting ? "Preparing…" : "Start diagnostic"}
          </button>
        )}

        {questions && !debrief && (
          <>
            <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">
                1. Writing Task 2 {writingSubmissionId && "✓"}
              </h2>
              {!writingSubmissionId ? (
                <>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {questions.writing.prompt}
                  </p>
                  <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                    {questions.writing.instructions}
                  </p>
                  <ExamTimer
                    key={questions.writing.id}
                    durationSeconds={TASK2_DURATION_SECONDS}
                    onExpire={handleSubmitEssay}
                  />
                  <EssayEditor
                    key={questions.writing.id}
                    value={essay}
                    onChange={setEssay}
                    editable
                    placeholder="Write your essay here…"
                  />
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        wordCount < questions.writing.expected_word_count
                          ? "text-sm text-amber-600 dark:text-amber-400"
                          : "text-sm text-zinc-500 dark:text-zinc-400"
                      }
                    >
                      {wordCount} / {questions.writing.expected_word_count} words
                    </span>
                    <button
                      type="button"
                      onClick={handleSubmitEssay}
                      disabled={evaluating || wordCount === 0}
                      className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
                    >
                      {evaluating ? "Evaluating…" : "Submit essay"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Essay scored{writingBand !== null ? ` — band ${writingBand.toFixed(1)}` : ""}. Your
                  tutor will walk through this once your plan is ready.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">
                2. Speaking long turn {speakingSubmissionId && "✓"}
              </h2>
              {!speakingSubmissionId ? (
                <SpeakingDrillFlow
                  initialQuestion={questions.speaking}
                  onComplete={setSpeakingSubmissionId}
                />
              ) : (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Recording scored. Your tutor will walk through this once your plan is ready.
                </p>
              )}
            </section>

            {bothDone && (
              <button
                type="button"
                onClick={handleFinish}
                disabled={finishing}
                className="w-fit rounded-full bg-violet-700 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:opacity-50 dark:bg-violet-600 dark:hover:bg-violet-500"
              >
                {finishing ? "Your tutor is putting together your plan…" : "Finish diagnostic"}
              </button>
            )}
          </>
        )}

        {debrief && (
          <section className="flex flex-col gap-4 rounded-lg border border-violet-300 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>
                🎓
              </span>
              <p className="whitespace-pre-line text-sm text-violet-950 dark:text-violet-100">
                {debrief}
              </p>
            </div>
            <Link
              href="/plan"
              className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              View my study plan →
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
