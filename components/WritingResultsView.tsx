"use client";

import { useState } from "react";
import { EssayEditor } from "./EssayEditor";

export type ScoredCriterionId = "TR" | "TA" | "CC" | "LR" | "GRA";

export interface CriterionResult {
  criterion: ScoredCriterionId;
  band: number;
  evidence: string[];
  why: string;
  wordCountPenaltyApplied: boolean;
  calibrationClamped: boolean;
}

export interface InlineErrorResult {
  quote: string;
  issue: string;
  correction: string;
  category: string;
}

export interface WritingResult {
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

const CRITERION_LABELS: Record<ScoredCriterionId, string> = {
  TR: "Task Response",
  TA: "Task Achievement",
  CC: "Coherence & Cohesion",
  LR: "Lexical Resource",
  GRA: "Grammatical Range & Accuracy",
};

interface RewriteState {
  paragraph: string;
  rewrittenText: string;
  targetBand: number;
  disclaimer: string;
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

interface WritingResultsViewProps {
  title: string;
  essayText: string;
  questionPrompt: string;
  result: WritingResult;
}

export function WritingResultsView({ title, essayText, questionPrompt, result }: WritingResultsViewProps) {
  const [rewritingParagraph, setRewritingParagraph] = useState<string | null>(null);
  const [rewriteResult, setRewriteResult] = useState<RewriteState | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  const paragraphs = essayText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const targetBand = Math.min(9, result.overallBand + 1);

  async function handleRewrite(paragraph: string) {
    setRewritingParagraph(paragraph);
    setRewriteError(null);
    try {
      const data = await postJson<{ rewrittenText: string; targetBand: number; disclaimer: string }>(
        "/api/writing/rewrite",
        { questionPrompt, paragraph, targetBand, submissionId: result.submissionId },
      );
      setRewriteResult({ paragraph, ...data });
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setRewritingParagraph(null);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {title}: {result.overallBand.toFixed(1)}
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            unrounded {result.overallUnrounded.toFixed(3)}
          </span>
        </div>
        {result.disagreementFlagged && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            The two scoring passes disagreed on at least one criterion — treat this result as
            provisional.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">
          {result.inlineErrors.length > 0
            ? "Your answer — errors highlighted, hover for the correction"
            : "Your answer"}
        </h3>
        <EssayEditor value={essayText} editable={false} errors={result.inlineErrors} />
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
                Capped at band 6 — under the word-count minimum.
              </p>
            )}
          </div>
        ))}
      </div>

      {result.inlineErrors.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">Inline errors</h3>
          <ul className="flex flex-col gap-3 text-sm">
            {result.inlineErrors.map((err, i) => (
              <li key={i} className="border-l-2 border-red-300 pl-3 dark:border-red-800">
                <p className="text-zinc-500 dark:text-zinc-400">
                  <span className="uppercase tracking-wide">{err.category}</span>
                </p>
                <p className="italic text-zinc-700 dark:text-zinc-300">&ldquo;{err.quote}&rdquo;</p>
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

      {paragraphs.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
            See a paragraph at Band {targetBand.toFixed(1)}
          </h3>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Pick a paragraph to see how it could look at your target band. AI-generated — a
            model of stronger execution, not something to copy verbatim.
          </p>
          {rewriteError && (
            <p className="mb-3 text-sm text-red-700 dark:text-red-400">{rewriteError}</p>
          )}
          <div className="flex flex-col gap-3">
            {paragraphs.map((paragraph, i) => (
              <div key={i} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{paragraph}</p>
                <button
                  type="button"
                  onClick={() => handleRewrite(paragraph)}
                  disabled={rewritingParagraph === paragraph}
                  className="mt-2 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {rewritingParagraph === paragraph
                    ? "Rewriting…"
                    : `Show me this at Band ${targetBand.toFixed(1)}`}
                </button>
                {rewriteResult?.paragraph === paragraph && (
                  <div className="mt-3 rounded-md border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                      AI-generated example — Band {rewriteResult.targetBand.toFixed(1)}
                    </p>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      {rewriteResult.rewrittenText}
                    </p>
                    <p className="mt-2 text-xs italic text-zinc-500 dark:text-zinc-400">
                      {rewriteResult.disclaimer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
