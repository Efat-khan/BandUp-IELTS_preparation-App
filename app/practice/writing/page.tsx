"use client";

import { useMemo, useState } from "react";
import { EssayEditor } from "@/components/EssayEditor";
import { ExamTimer } from "@/components/ExamTimer";
import { TutorChat } from "@/components/TutorChat";
import { TutorFeedback } from "@/components/TutorFeedback";
import { WritingResultsView, type WritingResult } from "@/components/WritingResultsView";
import type { QuestionGenerationContract } from "@/lib/gemini/schemas/question";

/** IELTS Task 2 is exam-recommended at ~40 minutes. */
const TASK2_DURATION_SECONDS = 40 * 60;

interface GeneratedQuestion extends QuestionGenerationContract {
  id: string;
  deduped_retry: boolean;
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

export default function WritingPracticePage() {
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [essay, setEssay] = useState("");
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<WritingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = useMemo(() => countWords(essay), [essay]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    setEssay("");
    try {
      const data = await postJson<GeneratedQuestion>("/api/questions/generate", {
        taskType: "task2",
      });
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
      const data = await postJson<WritingResult>("/api/evaluate/writing", {
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

        {question && !result && (
          <ExamTimer
            key={question.id}
            durationSeconds={TASK2_DURATION_SECONDS}
            onExpire={handleSubmit}
          />
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

            {!result && (
              <>
                <EssayEditor
                  key={question.id}
                  value={essay}
                  onChange={setEssay}
                  editable
                  placeholder="Write your essay here…"
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
              </>
            )}
          </section>
        )}

        {result && (
          <>
            <TutorFeedback submissionId={result.submissionId} />
            <WritingResultsView
              title="Overall band"
              essayText={essay}
              questionPrompt={question?.prompt ?? ""}
              result={result}
            />
            <TutorChat submissionId={result.submissionId} />
          </>
        )}
      </main>
    </div>
  );
}
