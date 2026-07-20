import * as z from "zod";

/**
 * Academic Writing Task 1 chart/diagram spec (spec §5.4 — not present in
 * this repo; this is a from-scratch design covering the standard IELTS
 * Academic Task 1 input types). A discriminated union on `type` so the
 * frontend ChartRenderer can render each kind directly with Recharts
 * (line/bar/pie) or as a structured panel (table/process/map).
 */

const SeriesPointSchema = z.object({ x: z.string(), y: z.number() });

const LineChartSpecSchema = z.object({
  type: z.literal("line"),
  title: z.string().min(1),
  xLabel: z.string().min(1),
  yLabel: z.string().min(1),
  series: z
    .array(z.object({ name: z.string().min(1), data: z.array(SeriesPointSchema).min(2) }))
    .min(1)
    .max(4),
});

const BarChartSpecSchema = z.object({
  type: z.literal("bar"),
  title: z.string().min(1),
  xLabel: z.string().min(1),
  yLabel: z.string().min(1),
  categories: z.array(z.string().min(1)).min(2).max(12),
  series: z
    .array(z.object({ name: z.string().min(1), data: z.array(z.number()) }))
    .min(1)
    .max(4),
});

const PieChartSpecSchema = z.object({
  type: z.literal("pie"),
  title: z.string().min(1),
  /** Almost always 1, occasionally 2 (e.g. "proportions in 2010 vs 2020"). */
  charts: z
    .array(
      z.object({
        title: z.string().min(1),
        slices: z.array(z.object({ label: z.string().min(1), value: z.number().min(0) })).min(2).max(8),
      }),
    )
    .min(1)
    .max(2),
});

const TableChartSpecSchema = z.object({
  type: z.literal("table"),
  title: z.string().min(1),
  columns: z.array(z.string().min(1)).min(2),
  rows: z.array(z.array(z.union([z.string(), z.number()]))).min(1),
});

const ProcessChartSpecSchema = z.object({
  type: z.literal("process"),
  title: z.string().min(1),
  steps: z.array(z.object({ label: z.string().min(1), description: z.string().min(1) })).min(2).max(10),
});

const MapChartSpecSchema = z.object({
  type: z.literal("map"),
  title: z.string().min(1),
  beforeLabel: z.string().min(1),
  afterLabel: z.string().min(1),
  changes: z.array(z.string().min(1)).min(1).max(10),
});

export const ChartSpecSchema = z.discriminatedUnion("type", [
  LineChartSpecSchema,
  BarChartSpecSchema,
  PieChartSpecSchema,
  TableChartSpecSchema,
  ProcessChartSpecSchema,
  MapChartSpecSchema,
]);

export type ChartSpec = z.infer<typeof ChartSpecSchema>;
export type LineChartSpec = z.infer<typeof LineChartSpecSchema>;
export type BarChartSpec = z.infer<typeof BarChartSpecSchema>;
export type PieChartSpec = z.infer<typeof PieChartSpecSchema>;
export type TableChartSpec = z.infer<typeof TableChartSpecSchema>;
export type ProcessChartSpec = z.infer<typeof ProcessChartSpecSchema>;
export type MapChartSpec = z.infer<typeof MapChartSpecSchema>;
