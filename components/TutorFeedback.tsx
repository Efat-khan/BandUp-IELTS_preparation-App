"use client";

import { useEffect, useState } from "react";
import { ConfidenceNote } from "./ConfidenceNote";

interface HumanizedCriterion {
  criterion: string;
  band: number;
  comment: string;
}

interface HumanizedFeedback {
  greeting: string;
  overallBand: number;
  overallComment: string;
  criterionComments: HumanizedCriterion[];
  priorityAction: string;
  encouragement: string;
}

async function fetchHumanized(submissionId: string): Promise<HumanizedFeedback> {
  const res = await fetch("/api/teacher/humanize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId }),
  });
  const data = (await res.json()) as HumanizedFeedback & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/**
 * The warm-teacher presentation of a result — fetched from the humanizer,
 * which never alters the bands shown in the scorer view below it. Fails
 * silently (renders nothing) so a teacher-layer hiccup never blocks the
 * learner from seeing their real result.
 */
export function TutorFeedback({ submissionId }: { submissionId: string }) {
  const [feedback, setFeedback] = useState<HumanizedFeedback | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHumanized(submissionId)
      .then((data) => {
        if (!cancelled) setFeedback(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (failed) return null;
  if (!feedback) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
        Your tutor is looking this over…
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-violet-300 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🎓
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
            Your tutor
          </p>
          <p className="text-sm text-violet-950 dark:text-violet-100">{feedback.greeting}</p>
        </div>
      </div>

      <div className="rounded-md bg-white/70 p-4 dark:bg-black/20">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Overall band {feedback.overallBand.toFixed(1)}
        </p>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{feedback.overallComment}</p>
        <ConfidenceNote className="mt-2 text-xs text-violet-600 dark:text-violet-400" />
      </div>

      <div className="flex flex-col gap-2">
        {feedback.criterionComments.map((c) => (
          <div key={c.criterion} className="flex gap-3 text-sm">
            <span className="w-12 shrink-0 font-mono font-semibold text-violet-700 dark:text-violet-300">
              {c.criterion} {c.band.toFixed(1)}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">{c.comment}</span>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-violet-300 bg-white/70 p-3 dark:border-violet-700 dark:bg-black/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
          Before your next attempt
        </p>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{feedback.priorityAction}</p>
      </div>

      <p className="text-sm italic text-violet-800 dark:text-violet-300">{feedback.encouragement}</p>
    </section>
  );
}
