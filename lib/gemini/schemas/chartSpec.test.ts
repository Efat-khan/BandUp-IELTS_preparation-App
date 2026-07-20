import { describe, expect, it } from "vitest";
import { ChartSpecSchema } from "./chartSpec";

describe("ChartSpecSchema", () => {
  it("accepts a valid line chart", () => {
    const result = ChartSpecSchema.safeParse({
      type: "line",
      title: "Internet usage 2000-2020",
      xLabel: "Year",
      yLabel: "% of population",
      series: [
        {
          name: "Country A",
          data: [
            { x: "2000", y: 10 },
            { x: "2010", y: 45 },
            { x: "2020", y: 80 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid two-pie-chart spec", () => {
    const result = ChartSpecSchema.safeParse({
      type: "pie",
      title: "Household spending, 2000 vs 2020",
      charts: [
        {
          title: "2000",
          slices: [
            { label: "Food", value: 40 },
            { label: "Housing", value: 30 },
            { label: "Other", value: 30 },
          ],
        },
        {
          title: "2020",
          slices: [
            { label: "Food", value: 25 },
            { label: "Housing", value: 45 },
            { label: "Other", value: 30 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid process spec", () => {
    const result = ChartSpecSchema.safeParse({
      type: "process",
      title: "How paper is recycled",
      steps: [
        { label: "Collection", description: "Used paper is collected from bins." },
        { label: "Sorting", description: "Paper is sorted by type and quality." },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown chart type", () => {
    const result = ChartSpecSchema.safeParse({ type: "scatter", title: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a bar chart with fewer than 2 categories", () => {
    const result = ChartSpecSchema.safeParse({
      type: "bar",
      title: "x",
      xLabel: "x",
      yLabel: "y",
      categories: ["Only one"],
      series: [{ name: "s", data: [1] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a table with fewer than 2 columns", () => {
    const result = ChartSpecSchema.safeParse({
      type: "table",
      title: "x",
      columns: ["OnlyOne"],
      rows: [["a"]],
    });
    expect(result.success).toBe(false);
  });
});
