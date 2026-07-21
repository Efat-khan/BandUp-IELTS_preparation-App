"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TutorChat } from "@/components/TutorChat";

type PlanUnitStatus = "PENDING" | "ACTIVE" | "MASTERED" | "INTERVENED";

interface PlanUnit {
  id: string;
  position: number;
  module: "WRITING" | "SPEAKING";
  criterion: string;
  title: string;
  rationale: string;
  actions: string[];
  status: PlanUnitStatus;
  baselineBand: number | null;
  targetBand: number | null;
  miniLessons: Array<{ id: string; title: string }>;
}

interface StudyPlanResponse {
  id: string;
  introduction: string | null;
  examDate: string | null;
  updatedAt: string;
  units: PlanUnit[];
}

const STATUS_LABELS: Record<PlanUnitStatus, string> = {
  PENDING: "Up next",
  ACTIVE: "In progress",
  MASTERED: "Mastered",
  INTERVENED: "New approach",
};

const STATUS_STYLES: Record<PlanUnitStatus, string> = {
  PENDING: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  ACTIVE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  MASTERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  INTERVENED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

async function fetchPlan(): Promise<StudyPlanResponse> {
  const res = await fetch("/api/teacher/plan");
  const data = (await res.json()) as StudyPlanResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

async function regeneratePlan(): Promise<StudyPlanResponse> {
  const res = await fetch("/api/teacher/plan", { method: "POST" });
  const data = (await res.json()) as StudyPlanResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export default function StudyPlanPage() {
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchPlan()
      .then(setPlan)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load plan"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      setPlan(await regeneratePlan());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate plan");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Study Plan</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Sequenced by your tutor from your error ledger and current band estimates.
          </p>
          <Link
            href="/practice"
            className="mt-2 inline-block text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back to practice modes
          </Link>
        </header>

        {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading your plan…</p>}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && !plan && !error && (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <p>No plan yet — complete the diagnostic to get a plan built from your actual results.</p>
            <Link
              href="/diagnostic"
              className="w-fit rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Start the diagnostic
            </Link>
          </div>
        )}

        {plan && (
          <>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-violet-300 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950">
              <p className="text-sm text-violet-950 dark:text-violet-100">{plan.introduction}</p>
            </div>

            <TutorChat title="Ask your tutor about your plan" />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {regenerating ? "Rebuilding…" : "Refresh plan from latest results"}
              </button>
            </div>

            <ol className="flex flex-col gap-4">
              {plan.units.map((unit) => (
                <li
                  key={unit.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600">
                        {unit.position + 1}.
                      </span>
                      <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">{unit.title}</h2>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLES[unit.status]}`}
                    >
                      {STATUS_LABELS[unit.status]}
                    </span>
                  </div>

                  <div className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                      {unit.module} · {unit.criterion}
                    </span>
                    {unit.baselineBand !== null && unit.targetBand !== null && (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-900">
                        {unit.baselineBand.toFixed(1)} → {unit.targetBand.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{unit.rationale}</p>

                  <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                    {unit.actions.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>

                  {unit.miniLessons.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {unit.miniLessons.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/lessons#${lesson.id}`}
                          className="rounded-full border border-violet-300 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950"
                        >
                          📖 {lesson.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}
