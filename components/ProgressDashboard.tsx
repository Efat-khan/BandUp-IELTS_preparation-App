"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MODULE_COLORS: Record<"WRITING" | "SPEAKING", string> = {
  WRITING: "#2563eb",
  SPEAKING: "#dc2626",
};
const CRITERION_TREND_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed"];

const CRITERION_LABELS: Record<string, string> = {
  TR: "Task Response",
  TA: "Task Achievement",
  CC: "Coherence & Cohesion",
  LR: "Lexical Resource",
  GRA: "Grammatical Range & Accuracy",
  FC: "Fluency & Coherence",
  PR: "Pronunciation",
};

interface TrendPoint {
  date: string;
  avgOverall: number | null;
  submissionsCount: number;
}

interface CriterionTrendPoint {
  date: string;
  avgBand: number;
}

interface HeatmapCell {
  criterion: string;
  label: string;
  avgBand: number | null;
  attemptCount: number;
}

interface Milestone {
  id: string;
  label: string;
}

interface ProgressResponse {
  evaluatorVersion: string;
  excludedDays: number;
  hasAnyData: boolean;
  trend: Record<"WRITING" | "SPEAKING", TrendPoint[]>;
  criterionTrend: Record<string, CriterionTrendPoint[]>;
  heatmap: Record<"WRITING" | "SPEAKING", HeatmapCell[]>;
  streak: { current: number; longest: number };
  attemptsCount: { WRITING: number; SPEAKING: number; total: number };
  averageTimeSpentSeconds: Record<"WRITING" | "SPEAKING", number | null>;
  milestones: Milestone[];
}

function formatMinutes(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "<1 min" : `${minutes} min`;
}

function buildOverallTrendRows(
  trend: Record<"WRITING" | "SPEAKING", TrendPoint[]>,
): Array<Record<string, string | number>> {
  const dates = new Set<string>();
  for (const moduleKey of ["WRITING", "SPEAKING"] as const) {
    for (const p of trend[moduleKey]) dates.add(p.date);
  }
  return [...dates].sort().map((date) => {
    const row: Record<string, string | number> = { date };
    for (const moduleKey of ["WRITING", "SPEAKING"] as const) {
      const point = trend[moduleKey].find((p) => p.date === date);
      if (point?.avgOverall !== null && point?.avgOverall !== undefined) {
        row[moduleKey] = point.avgOverall;
      }
    }
    return row;
  });
}

function buildCriterionTrendRows(
  criterionTrend: Record<string, CriterionTrendPoint[]>,
  keys: string[],
): Array<Record<string, string | number>> {
  const dates = new Set<string>();
  for (const key of keys) for (const p of criterionTrend[key] ?? []) dates.add(p.date);
  return [...dates].sort().map((date) => {
    const row: Record<string, string | number> = { date };
    for (const key of keys) {
      const point = (criterionTrend[key] ?? []).find((p) => p.date === date);
      if (point) row[key] = point.avgBand;
    }
    return row;
  });
}

function heatmapCellColor(avgBand: number | null): string {
  if (avgBand === null) return "bg-zinc-100 dark:bg-zinc-900";
  // Single-hue sequential ramp (Tailwind blue), band 0-9 mapped to lightness steps.
  if (avgBand < 4) return "bg-blue-100 dark:bg-blue-950";
  if (avgBand < 5) return "bg-blue-200 dark:bg-blue-900";
  if (avgBand < 6) return "bg-blue-300 dark:bg-blue-800";
  if (avgBand < 7) return "bg-blue-400 dark:bg-blue-700";
  if (avgBand < 8) return "bg-blue-500 dark:bg-blue-600";
  return "bg-blue-600 dark:bg-blue-500";
}

function heatmapTextColor(avgBand: number | null): string {
  if (avgBand === null) return "text-zinc-400 dark:text-zinc-600";
  return avgBand >= 6 ? "text-white" : "text-zinc-900 dark:text-zinc-50";
}

async function fetchProgress(userId?: string): Promise<ProgressResponse> {
  const params = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await fetch(`/api/progress${params}`);
  const data = (await res.json()) as ProgressResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</span>
      {sub && <span className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</span>}
    </div>
  );
}

function HeatmapRow({ moduleLabel, cells }: { moduleLabel: string; cells: HeatmapCell[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{moduleLabel}</h4>
      <div className="grid grid-cols-4 gap-2">
        {cells.map((cell) => (
          <div
            key={cell.criterion}
            className={`flex flex-col items-center justify-center gap-1 rounded-md p-3 text-center ${heatmapCellColor(cell.avgBand)}`}
          >
            <span className={`text-lg font-semibold ${heatmapTextColor(cell.avgBand)}`}>
              {cell.avgBand !== null ? cell.avgBand.toFixed(1) : "—"}
            </span>
            <span className={`text-[11px] leading-tight ${heatmapTextColor(cell.avgBand)}`}>
              {cell.label}
            </span>
            {cell.attemptCount > 0 && (
              <span
                className={`text-[10px] ${cell.avgBand !== null && cell.avgBand >= 6 ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {cell.attemptCount} scored
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressDashboard({ userId }: { userId?: string }) {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProgress(userId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load progress");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data && !error) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading progress…</p>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {error}
      </div>
    );
  }
  if (!data) return null;

  if (!data.hasAnyData) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        No scored attempts yet. Complete a practice session — a quick drill, a weakness drill, or a
        full mock — and your progress will show up here.
      </div>
    );
  }

  const overallRows = buildOverallTrendRows(data.trend);
  const writingCriterionKeys = ["TR", "TA", "CC", "LR", "GRA"].map((c) => `WRITING:${c}`);
  const speakingCriterionKeys = ["FC", "LR", "GRA", "PR"].map((c) => `SPEAKING:${c}`);
  const writingCriterionRows = buildCriterionTrendRows(data.criterionTrend, writingCriterionKeys);
  const speakingCriterionRows = buildCriterionTrendRows(data.criterionTrend, speakingCriterionKeys);

  return (
    <div className="flex flex-col gap-8">
      {data.milestones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.milestones.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >
              🏅 {m.label}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Current streak"
          value={`${data.streak.current} day${data.streak.current === 1 ? "" : "s"}`}
          sub={`Longest: ${data.streak.longest}`}
        />
        <StatTile
          label="Total attempts"
          value={String(data.attemptsCount.total)}
          sub={`Writing ${data.attemptsCount.WRITING} · Speaking ${data.attemptsCount.SPEAKING}`}
        />
        <StatTile
          label="Avg. time — Writing"
          value={formatMinutes(data.averageTimeSpentSeconds.WRITING)}
        />
        <StatTile
          label="Avg. time — Speaking"
          value={formatMinutes(data.averageTimeSpentSeconds.SPEAKING)}
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
          Overall band trend by skill
        </h3>
        {overallRows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Not enough data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={overallRows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="WRITING"
                name="Writing"
                stroke={MODULE_COLORS.WRITING}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="SPEAKING"
                name="Speaking"
                stroke={MODULE_COLORS.SPEAKING}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {data.excludedDays > 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {data.excludedDays} earlier day{data.excludedDays === 1 ? "" : "s"} scored under a
            previous evaluator version {data.excludedDays === 1 ? "is" : "are"} excluded from this
            trend, so scores are never blended across scoring-logic changes.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
            Writing criteria trend
          </h3>
          {writingCriterionRows.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Not enough data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={writingCriterionRows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {writingCriterionKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={CRITERION_LABELS[key.split(":")[1]]}
                    stroke={CRITERION_TREND_COLORS[i % CRITERION_TREND_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
            Speaking criteria trend
          </h3>
          {speakingCriterionRows.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Not enough data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={speakingCriterionRows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {speakingCriterionKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={CRITERION_LABELS[key.split(":")[1]]}
                    stroke={CRITERION_TREND_COLORS[i % CRITERION_TREND_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
          Weakness heatmap — all-time average band per criterion
        </h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Darker = stronger. Feeds the weakness drill, which always targets your lowest cell.
        </p>
        <div className="flex flex-col gap-5">
          <HeatmapRow moduleLabel="Writing" cells={data.heatmap.WRITING} />
          <HeatmapRow moduleLabel="Speaking" cells={data.heatmap.SPEAKING} />
        </div>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-600">
        Scored with evaluator version {data.evaluatorVersion}.
      </p>
    </div>
  );
}
