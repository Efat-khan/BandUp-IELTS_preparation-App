"use client";

import { useMemo, useState } from "react";
import type { WritingCriterionId } from "@/lib/descriptors/writingTask2";
import type { QuestionGenerationContract } from "@/lib/gemini/schemas/question";

interface GeneratedQuestion extends QuestionGenerationContract {
  id: string;
  deduped_retry: boolean;
}

interface CriterionResult {
  criterion: WritingCriterionId;
  band: number;
  evidence: string[];
  why: string;
  wordCountPenaltyApplied: boolean;
  calibrationClamped: boolean;
}

interface InlineErrorResult {
  quote: string;
  issue: string;
  correction: string;
  category: string;
}

interface EvaluationResult {
  submissionId: string;
  status: string;
  overallBand: number;
  overallUnrounded: number;
  disagreementFlagged: boolean;
  wordCount: number;
  criteria: CriterionResult[];
  inlineErrors: InlineErrorResult[];
  nextBandActions: string[];
  modelSelfEstimatedBand: number;
}

const CRITERION_LABELS: Record<WritingCriterionId, string> = {
  TR: "Task Response",
  CC: "Coherence & Cohesion",
  LR: "Lexical Resource",
  GRA: "Grammatical Range & Accuracy",
};

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

export default function WritingPracticePage() {
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [essay, setEssay] = useState("");
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = useMemo(() => countWords(essay), [essay]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    setEssay("");
    try {
      const data = await postJson<GeneratedQuestion>("/api/questions/generate", {});
      setQuestion(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate question");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit() {
    if (!question) return;
    setEvaluating(true);
    setError(null);
    setResult(null);
    try {
      const data = await postJson<EvaluationResult>("/api/evaluate/writing", {
        questionId: question.id,
        text: essay,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Writing Task 2 Practice
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Generate a prompt, write your essay, and get an evidence-based band
            estimate.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {!question && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-fit rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {generating ? "Generating…" : "Generate Task 2"}
          </button>
        )}

        {question && (
          <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                {question.test_type}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                {question.topic_tag}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                {question.difficulty}
              </span>
              {question.deduped_retry && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  re-generated to avoid a repeat topic
                </span>
              )}
            </div>
            <p className="text-base text-zinc-900 dark:text-zinc-100">{question.prompt}</p>
            <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
              {question.instructions}
            </p>

            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="Write your essay here…"
              rows={14}
              className="w-full resize-y rounded-md border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />

            <div className="flex items-center justify-between">
              <span
                className={
                  wordCount < question.expected_word_count
                    ? "text-sm text-amber-600 dark:text-amber-400"
                    : "text-sm text-zinc-500 dark:text-zinc-400"
                }
              >
                {wordCount} / {question.expected_word_count} words
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={evaluating || wordCount === 0}
                className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
              >
                {evaluating ? "Evaluating…" : "Submit for scoring"}
              </button>
            </div>
          </section>
        )}

        {result && (
          <section className="flex flex-col gap-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  Overall band: {result.overallBand.toFixed(1)}
                </h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  unrounded {result.overallUnrounded.toFixed(3)}
                </span>
              </div>
              {result.disagreementFlagged && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  The two scoring passes disagreed on at least one criterion —
                  treat this result as provisional.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {result.criteria.map((c) => (
                <div
                  key={c.criterion}
                  className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                      {CRITERION_LABELS[c.criterion]}
                    </h3>
                    <span className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                      {c.band.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{c.why}</p>
                  {c.evidence.length > 0 && (
                    <ul className="flex flex-col gap-1 text-sm">
                      {c.evidence.map((quote, i) => (
                        <li
                          key={i}
                          className="rounded bg-zinc-100 px-2 py-1 italic text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          &ldquo;{quote}&rdquo;
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.wordCountPenaltyApplied && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Capped at band 6 — under the 250-word minimum.
                    </p>
                  )}
                </div>
              ))}
            </div>

            {result.inlineErrors.length > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
                  Inline errors
                </h3>
                <ul className="flex flex-col gap-3 text-sm">
                  {result.inlineErrors.map((err, i) => (
                    <li key={i} className="border-l-2 border-red-300 pl-3 dark:border-red-800">
                      <p className="text-zinc-500 dark:text-zinc-400">
                        <span className="uppercase tracking-wide">{err.category}</span>
                      </p>
                      <p className="italic text-zinc-700 dark:text-zinc-300">
                        &ldquo;{err.quote}&rdquo;
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">{err.issue}</p>
                      <p className="text-emerald-700 dark:text-emerald-400">→ {err.correction}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
                Top 3 next-band actions
              </h3>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {result.nextBandActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
