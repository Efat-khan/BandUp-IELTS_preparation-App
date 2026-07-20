# Calibration gold set

`scripts/calibrate.ts` (`npm run calibrate`) reads every `*.json` file in this
directory and runs it through `evaluateWritingTask2()` — the same evaluation
core the `/api/evaluate/writing` route uses — then compares the predicted
band against the official band you provide.

## File format

```json
{
  "id": "gold-001",
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

- `instructions` is optional — a default is used if omitted.
- `official_bands.overall` is the essay's real, officially-awarded Task 2
  band (what the report's MAE / ±0.5 figures are measured against).

## Placeholder files

`_placeholder-*.json` in this directory are **synthetic**, marked with
`"synthetic": true` — invented essays with invented "official" bands, used
only to prove the harness runs end to end. The calibration report prints a
loud warning whenever synthetic files are present and its MAE/±0.5 numbers
are not a real accuracy measurement in that case.

**Replace or remove the placeholders once real essays-with-known-official-bands
are added** (e.g. real IELTS Task 2 responses with an official examiner
band), and add as many as you have — the target is ≥85% of essays landing
within ±0.5 band of the official score.
