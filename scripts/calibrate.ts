/**
 * Calibration harness: runs the Writing evaluator (Task 1 Academic/General
 * or Task 2) over a gold set of essays with known official bands and
 * reports MAE + % within ±0.5 band, plus a per-criterion drift table.
 *
 * Usage: npm run calibrate
 *
 * Reads every *.json file in /calibration (see calibration/README.md for
 * the expected shape). Does not touch the database — this is purely a
 * model-accuracy measurement against evaluateWritingSubmission(), the same
 * core function the /api/evaluate/writing and /api/mock/writing/submit
 * routes use.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as z from "zod";
import { evaluateWritingSubmission, type WritingTaskKind } from "../lib/scoring/evaluateWriting";

const CALIBRATION_DIR = path.resolve(__dirname, "../calibration");
const DEFAULT_INSTRUCTIONS_BY_TASK: Record<WritingTaskKind, string> = {
  task2: "You should spend about 40 minutes on this task and write at least 250 words.",
  task1_academic: "You should spend about 20 minutes on this task and write at least 150 words.",
  task1_general: "You should spend about 20 minutes on this task and write at least 150 words.",
};
const TARGET_WITHIN_HALF_BAND_PCT = 85;

const CalibrationEssaySchema = z.object({
  id: z.string(),
  /** Mark true for placeholder essays used only to exercise the harness — never real gold data. */
  synthetic: z.boolean().optional().default(false),
  task_kind: z.enum(["task1_academic", "task1_general", "task2"]).optional().default("task2"),
  prompt: z.string(),
  instructions: z.string().optional(),
  essay: z.string(),
  official_bands: z
    .object({
      /** Task 2 only. */
      task_response: z.number().optional(),
      /** Task 1 (either variant) only. */
      task_achievement: z.number().optional(),
      coherence_cohesion: z.number(),
      lexical_resource: z.number(),
      grammatical_range_accuracy: z.number(),
      overall: z.number(),
    })
    .refine((v) => v.task_response !== undefined || v.task_achievement !== undefined, {
      message: "official_bands must include task_response (Task 2) or task_achievement (Task 1)",
    }),
});

type CalibrationEssay = z.infer<typeof CalibrationEssaySchema>;

const SECONDARY_CRITERIA_KEYS = [
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
] as const;

interface ScoredRow {
  id: string;
  synthetic: boolean;
  taskKind: WritingTaskKind;
  officialPrimary: number;
  officialSecondary: Record<(typeof SECONDARY_CRITERIA_KEYS)[number], number>;
  officialOverall: number;
  predictedPrimary: number;
  predictedSecondary: Record<(typeof SECONDARY_CRITERIA_KEYS)[number], number>;
  predictedOverall: number;
}

interface SkippedRow {
  id: string;
  synthetic: boolean;
  reason: string;
}

function loadCalibrationFiles(): CalibrationEssay[] {
  let filenames: string[];
  try {
    filenames = readdirSync(CALIBRATION_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    filenames = [];
  }
  return filenames.map((filename) => {
    const raw = JSON.parse(readFileSync(path.join(CALIBRATION_DIR, filename), "utf-8"));
    return CalibrationEssaySchema.parse(raw);
  });
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
function padLeft(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

async function main() {
  const essays = loadCalibrationFiles();

  if (essays.length === 0) {
    console.log(
      `No calibration files found in ${CALIBRATION_DIR}.\n` +
        "Add gold essays as *.json (see calibration/README.md for the format) and re-run `npm run calibrate`.",
    );
    return;
  }

  const scored: ScoredRow[] = [];
  const skipped: SkippedRow[] = [];

  for (const essay of essays) {
    process.stdout.write(`Evaluating ${essay.id} (${essay.task_kind})... `);
    try {
      const outcome = await evaluateWritingSubmission({
        taskKind: essay.task_kind,
        questionPrompt: essay.prompt,
        instructions: essay.instructions ?? DEFAULT_INSTRUCTIONS_BY_TASK[essay.task_kind],
        essayText: essay.essay,
      });

      if (outcome.shortCircuited || !outcome.criteria || outcome.taskBand === undefined) {
        const reason = outcome.shortCircuitReason ?? "evaluation did not complete";
        console.log(`SKIPPED (${reason})`);
        skipped.push({ id: essay.id, synthetic: essay.synthetic, reason });
        continue;
      }

      const officialPrimary =
        essay.official_bands.task_response ?? essay.official_bands.task_achievement!;

      console.log(`done (predicted ${outcome.taskBand}, official ${essay.official_bands.overall})`);
      scored.push({
        id: essay.id,
        synthetic: essay.synthetic,
        taskKind: essay.task_kind,
        officialPrimary,
        officialSecondary: {
          coherence_cohesion: essay.official_bands.coherence_cohesion,
          lexical_resource: essay.official_bands.lexical_resource,
          grammatical_range_accuracy: essay.official_bands.grammatical_range_accuracy,
        },
        officialOverall: essay.official_bands.overall,
        predictedPrimary: outcome.criteria[outcome.primaryCriterion].finalBand,
        predictedSecondary: {
          coherence_cohesion: outcome.criteria.CC.finalBand,
          lexical_resource: outcome.criteria.LR.finalBand,
          grammatical_range_accuracy: outcome.criteria.GRA.finalBand,
        },
        predictedOverall: outcome.taskBand,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`SKIPPED (${reason})`);
      skipped.push({ id: essay.id, synthetic: essay.synthetic, reason });
    }
  }

  console.log("\n=== Calibration Report ===");
  console.log(`Essays loaded: ${essays.length}`);
  console.log(`Scored: ${scored.length}  Skipped: ${skipped.length}`);
  if (skipped.length > 0) {
    for (const s of skipped) console.log(`  - ${s.id}: ${s.reason}`);
  }

  if (scored.length === 0) {
    console.log("\nNo essays were successfully scored — no MAE/drift figures to report.");
    return;
  }

  const overallErrors = scored.map((r) => Math.abs(r.predictedOverall - r.officialOverall));
  const mae = overallErrors.reduce((a, b) => a + b, 0) / overallErrors.length;
  const withinHalf = overallErrors.filter((e) => e <= 0.5).length;
  const withinHalfPct = (withinHalf / scored.length) * 100;

  console.log(`\nOverall MAE: ${mae.toFixed(3)}`);
  console.log(
    `Within ±0.5 band: ${withinHalf}/${scored.length} (${withinHalfPct.toFixed(1)}%) — target ${TARGET_WITHIN_HALF_BAND_PCT}% — ${
      withinHalfPct >= TARGET_WITHIN_HALF_BAND_PCT ? "MET" : "NOT MET"
    }`,
  );

  console.log("\nPer-criterion drift (predicted - official):");
  console.log(padRight("criterion", 28) + padLeft("mean signed", 14) + padLeft("MAE", 10));

  const primaryDiffs = scored.map((r) => r.predictedPrimary - r.officialPrimary);
  const primaryMeanSigned = primaryDiffs.reduce((a, b) => a + b, 0) / primaryDiffs.length;
  const primaryMae = primaryDiffs.reduce((a, b) => a + Math.abs(b), 0) / primaryDiffs.length;
  console.log(
    padRight("primary (TR/TA)", 28) +
      padLeft(primaryMeanSigned.toFixed(3), 14) +
      padLeft(primaryMae.toFixed(3), 10),
  );

  for (const key of SECONDARY_CRITERIA_KEYS) {
    const diffs = scored.map((r) => r.predictedSecondary[key] - r.officialSecondary[key]);
    const meanSigned = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const criterionMae = diffs.reduce((a, b) => a + Math.abs(b), 0) / diffs.length;
    console.log(
      padRight(key, 28) + padLeft(meanSigned.toFixed(3), 14) + padLeft(criterionMae.toFixed(3), 10),
    );
  }

  const syntheticCount = essays.filter((e) => e.synthetic).length;
  if (syntheticCount > 0) {
    console.log(
      `\n⚠ ${syntheticCount}/${essays.length} essay(s) are SYNTHETIC PLACEHOLDERS (synthetic: true), not real official-band gold data.`,
    );
    console.log(
      "  The figures above only prove the harness runs end to end — they are not a real accuracy measurement.",
    );
    console.log("  Replace them with real essays-with-known-official-bands and re-run.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
