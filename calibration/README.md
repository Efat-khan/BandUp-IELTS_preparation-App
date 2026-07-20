# Calibration gold set

`scripts/calibrate.ts` (`npm run calibrate`) reads every `*.json` file in this
directory and runs it through `evaluateWritingSubmission()` — the same
evaluation core the `/api/evaluate/writing` and `/api/mock/writing/submit`
routes use — then compares the predicted band against the official band you
provide.

## File format

```json
{
  "id": "gold-001",
  "task_kind": "task2",
  "prompt": "Some people believe that ... Discuss both views and give your own opinion.",
  "instructions": "You should spend about 40 minutes on this task and write at least 250 words.",
  "essay": "The full text of the candidate's essay...",
  "official_bands": {
    "task_response": 6.5,
    "coherence_cohesion": 6.0,
    "lexical_resource": 6.5,
    "grammatical_range_accuracy": 6.0,
    "overall": 6.5
  }
}
```

- `task_kind` is one of `"task2"` (default if omitted), `"task1_academic"`,
  or `"task1_general"`.
- `instructions` is optional — a task-appropriate default is used if omitted.
- For Task 2, `official_bands.task_response` is the official Task Response
  band. For Task 1 (either variant), use `official_bands.task_achievement`
  instead — the schema requires exactly one of the two.
- `official_bands.overall` is the essay's real, officially-awarded band for
  that single task (what the report's MAE / ±0.5 figures are measured
  against) — not the combined Writing module band.

## Placeholder files

`_placeholder-*.json` in this directory are **synthetic**, marked with
`"synthetic": true` — invented essays with invented "official" bands, used
only to prove the harness runs end to end across all three task kinds. The
calibration report prints a loud warning whenever synthetic files are
present and its MAE/±0.5 numbers are not a real accuracy measurement in
that case.

**Replace or remove the placeholders once real essays-with-known-official-bands
are added** (e.g. real IELTS Task 1/Task 2 responses with an official
examiner band), and add as many as you have — the target is ≥85% of
essays landing within ±0.5 band of the official score. Before merging any
change to the evaluator (prompts, descriptors, guardrails), re-run
`npm run calibrate` against the real gold set and do not merge if the
within-±0.5 percentage drops.
