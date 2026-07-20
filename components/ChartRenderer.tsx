"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/gemini/schemas/chartSpec";

const SERIES_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706"];
const PIE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

function LineChartView({ spec }: { spec: Extract<ChartSpec, { type: "line" }> }) {
  const xValues = spec.series[0]?.data.map((p) => p.x) ?? [];
  const rows = xValues.map((x, i) => {
    const row: Record<string, string | number> = { x };
    for (const s of spec.series) row[s.name] = s.data[i]?.y ?? 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
        <XAxis dataKey="x" label={{ value: spec.xLabel, position: "insideBottom", offset: -4 }} />
        <YAxis label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        {spec.series.map((s, i) => (
          <Line
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarChartView({ spec }: { spec: Extract<ChartSpec, { type: "bar" }> }) {
  const rows = spec.categories.map((category, i) => {
    const row: Record<string, string | number> = { category };
    for (const s of spec.series) row[s.name] = s.data[i] ?? 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
        <XAxis dataKey="category" label={{ value: spec.xLabel, position: "insideBottom", offset: -4 }} />
        <YAxis label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        {spec.series.map((s, i) => (
          <Bar key={s.name} dataKey={s.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ spec }: { spec: Extract<ChartSpec, { type: "pie" }> }) {
  return (
    <div className={`grid gap-4 ${spec.charts.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
      {spec.charts.map((chart) => (
        <div key={chart.title} className="flex flex-col items-center">
          <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{chart.title}</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={chart.slices} dataKey="value" nameKey="label" outerRadius={90} label>
                {chart.slices.map((slice, i) => (
                  <Cell key={slice.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}

function TableChartView({ spec }: { spec: Extract<ChartSpec, { type: "table" }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {spec.columns.map((col) => (
              <th
                key={col}
                className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-left font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border border-zinc-200 px-3 py-2 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProcessChartView({ spec }: { spec: Extract<ChartSpec, { type: "process" }> }) {
  return (
    <ol className="flex flex-col gap-3">
      {spec.steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            {i + 1}
          </span>
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{step.label}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function MapChartView({ spec }: { spec: Extract<ChartSpec, { type: "map" }> }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{spec.beforeLabel}</p>
      </div>
      <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{spec.afterLabel}</p>
      </div>
      <ul className="col-span-full flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
        {spec.changes.map((change, i) => (
          <li key={i}>{change}</li>
        ))}
      </ul>
    </div>
  );
}

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">{spec.title}</h3>
      {spec.type === "line" && <LineChartView spec={spec} />}
      {spec.type === "bar" && <BarChartView spec={spec} />}
      {spec.type === "pie" && <PieChartView spec={spec} />}
      {spec.type === "table" && <TableChartView spec={spec} />}
      {spec.type === "process" && <ProcessChartView spec={spec} />}
      {spec.type === "map" && <MapChartView spec={spec} />}
    </div>
  );
}
