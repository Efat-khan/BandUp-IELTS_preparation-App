"use client";

import { useMemo, useState } from "react";
import { ChartRenderer } from "@/components/ChartRenderer";
import { EssayEditor } from "@/components/EssayEditor";
import { ExamTimer } from "@/components/ExamTimer";
import { SpeakingDrillFlow, type DrillQuestion } from "@/components/SpeakingDrillFlow";
import { TutorChat } from "@/components/TutorChat";
import { TutorFeedback } from "@/components/TutorFeedback";
import { WritingResultsView, type WritingResult } from "@/components/WritingResultsView";
import type { ChartSpec } from "@/lib/gemini/schemas/chartSpec";

type DrillType = "task1_academic" | "task2" | "speaking_part2";

/** IELTS exam-recommended durations: Task 1 ~20 min, Task 2 ~40 min. */
const WRITING_DRILL_DURATION_SECONDS: Record<"task1_academic" | "task2", number> = {
  task1_academic: 20 * 60,
  task2: 40 * 60,
};

interface WritingDrillQuestion {
  id: string;
  test_type?: "academic" | "general";
  topic_tag: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  instructions: string;
  expected_word_count: number;
  chart_spec?: ChartSpec;
  register?: "formal" | "semi_formal" | "informal";
  deduped_retry?: boolean;
}

interface WeaknessDrillResponse {
  criterion: string;
  module: "WRITING" | "SPEAKING";
  avgBand: number;
  attemptCount: number;
  drillType: DrillType;
  question: WritingDrillQuestion | DrillQuestion;
}

const CRITERION_LABELS: Record<string, string> = {
  TR: "Task Response",
  TA: "Task Achievement",
  CC: "Coherence & Cohesion",
  LR: "Lexical Resource",
  GRA: "Grammatical Range & Accuracy",
  FC: "Fluency & Coherence",
  PR: "Pronunciation",
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
  if (!res.ok) throw new Error(data.error ?? `Request to ${url} failed (${res.status})`);
  return data;
}

export default function WeaknessDrillPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<WeaknessDrillResponse | null>(null);

  const [essay, setEssay] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<WritingResult | null>(null);

  const wordCount = useMemo(() => countWords(essay), [essay]);

  async function handleFindWeakness() {
    setLoading(true);
    setError(null);
    setDrill(null);
    setEssay("");
    setResult(null);
    try {
      const data = await postJson<WeaknessDrillResponse>("/api/practice/weakness-drill", {});
      setDrill(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to find a weakness drill");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitEssay() {
    if (!drill || drill.drillType === "speaking_part2") return;
    const question = drill.question as WritingDrillQuestion;
    setEvaluating(true);
    setError(null);
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
            Weakness Drill
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Automatically serves a task targeting your lowest-scoring criterion across all
            scored attempts.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {!drill && (
          <button
            type="button"
            onClick={handleFindWeakness}
            disabled={loading}
            className="w-fit rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {loading ? "Finding your weakest criterion…" : "Find my weakness drill"}
          </button>
        )}

        {drill && (
          <div className="rounded-lg border border-violet-300 bg-violet-50 p-4 text-sm dark:border-violet-800 dark:bg-violet-950">
            <p className="text-violet-900 dark:text-violet-200">
              Your lowest-scoring criterion is{" "}
              <span className="font-semibold">
                {CRITERION_LABELS[drill.criterion] ?? drill.criterion}
              </span>{" "}
              ({drill.module.toLowerCase()}) — average band {drill.avgBand.toFixed(1)} across{" "}
              {drill.attemptCount} scored attempt{drill.attemptCount === 1 ? "" : "s"}.
            </p>
          </div>
        )}

        {drill && drill.drillType === "speaking_part2" && (
          <SpeakingDrillFlow initialQuestion={drill.question as DrillQuestion} />
        )}

        {drill && drill.drillType !== "speaking_part2" && !result && (
          <ExamTimer
            key={drill.question.id}
            durationSeconds={
              WRITING_DRILL_DURATION_SECONDS[drill.drillType as "task1_academic" | "task2"]
            }
            onExpire={handleSubmitEssay}
          />
        )}

        {drill && drill.drillType !== "speaking_part2" && !result && (
          <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            {(() => {
              const question = drill.question as WritingDrillQuestion;
              return (
                <>
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {question.test_type && (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                        {question.test_type}
                      </span>
                    )}
                    <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                      {question.topic_tag}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                      {question.difficulty}
                    </span>
                  </div>

                  {question.chart_spec && <ChartRenderer spec={question.chart_spec} />}

                  <p className="whitespace-pre-line text-base text-zinc-900 dark:text-zinc-100">
                    {question.prompt}
                  </p>
                  <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
                    {question.instructions}
                  </p>

                  <EssayEditor
                    key={question.id}
                    value={essay}
                    onChange={setEssay}
                    editable
                    placeholder="Write your response here…"
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
                      onClick={handleSubmitEssay}
                      disabled={evaluating || wordCount === 0}
                      className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
                    >
                      {evaluating ? "Evaluating…" : "Submit for scoring"}
                    </button>
                  </div>
                </>
              );
            })()}
          </section>
        )}

        {drill && drill.drillType !== "speaking_part2" && result && (
          <>
            <TutorFeedback submissionId={result.submissionId} />
            <WritingResultsView
              title="Overall band"
              essayText={essay}
              questionPrompt={(drill.question as WritingDrillQuestion).prompt}
              result={result}
            />
            <TutorChat submissionId={result.submissionId} />
          </>
        )}
      </main>
    </div>
  );
}
