# BandUp — AI-powered IELTS Writing & Speaking Tutor

Scaffold stage. The authoritative product/technical spec lives in
`BandUp_Documentation.md` (not yet committed to this repository — add it at
the repo root).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS, as a PWA
- Next.js API routes (Node) for orchestration
- PostgreSQL via Prisma ORM
- Google Gemini via `@google/genai` (model routing pinned in `lib/gemini/models.ts`)
- Later phases: STT with word timestamps, S3-compatible audio storage, Clerk auth

## Layout

```
/app              Next.js routes + pages (health check at /health)
/lib/gemini       Gemini client, model routing config, structured-output helpers
/lib/scoring      Rounding, band combination, guardrails, double-pass
/lib/prompts      Evaluator + generator system prompts
/lib/descriptors  Band descriptor KB as typed constants
/prisma           schema.prisma + migrations
/components       UI components
```

## Setup

```bash
cp .env.example .env   # fill in GEMINI_API_KEY and DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev
```

## Tests

```bash
npm test
```

## Phase 1: Writing Task 2 evaluation loop

End-to-end question generation → evaluation loop for IELTS Writing Task 2.

- `POST /api/questions/generate` — generates one Task 2 prompt (Gemini
  Flash + Search grounding), de-duped against the requesting user's last 20
  questions. Body: `{ userId?, testType?: "academic"|"general", difficulty?: "easy"|"medium"|"hard" }`
  (all optional — falls back to a single upserted demo user until real auth
  is wired).
- `POST /api/evaluate/writing` — scores an essay against the question.
  Body: `{ questionId, text, userId? }`. Runs code pre-checks (word count,
  empty/gibberish/off-topic, paragraph count, memorized-template
  detection), then double-pass structured scoring on Gemini Pro at
  temperature 0, then code post-processing (word-count Task Response cap,
  calibration ceiling clamp). Persists the submission, both raw passes and
  the canonical score, and feedback.
- `/practice/writing` — minimal UI: generate a prompt, write in a
  live-word-count editor, submit, and see the overall band, four criterion
  cards (band/why/evidence), inline errors, and top-3 next-band actions.

### Calibration harness

```bash
npm run calibrate
```

Runs every `*.json` gold essay in `/calibration` through the same
evaluation core the API uses and reports MAE + % within ±0.5 band (target
≥85%) plus a per-criterion drift table. See `calibration/README.md` for the
file format — the `_placeholder-*.json` files there are synthetic
(`"synthetic": true`) and only prove the harness runs; replace them with
real essays-with-known-official-bands for a real accuracy measurement.

## Phase 2: complete Writing module (Task 1 + Task 2 + mock)

- `POST /api/questions/generate` now accepts `taskType: "task1_academic" |
  "task1_general" | "task2"` (default `"task2"`). Academic Task 1 responses
  include a `chart_spec` (line/bar/pie/table, or a process/map description)
  rendered on the frontend with Recharts (`components/ChartRenderer.tsx`).
  General Task 1 responses are a letter prompt with a `register`
  (`formal`/`semi_formal`/`informal`).
- `POST /api/evaluate/writing` detects the question's task type and scores
  against the right descriptor set — Task Achievement (TA) for Task 1
  (Academic data-reporting accuracy vs. General letter purpose/tone/
  coverage) or Task Response (TR) for Task 2 — with a 150-word minimum for
  Task 1 vs. 250 for Task 2. Same double-pass/guardrail pipeline
  (`lib/scoring/evaluateWriting.ts`, generalized across all three task
  kinds).
- `/practice/writing/task1` — Academic (chart) or General (letter) Task 1
  practice, same results view as Task 2.
- Full mock (`/practice/writing/mock`, `POST /api/mock/writing/start` +
  `/api/mock/writing/submit`): one timed 60-minute session pairing a
  generated Task 1 + Task 2, submitted and scored together. The overall
  Writing band combines the two per-task bands via `combineWritingBand()`
  (`(task1 + 2×task2) / 3`, then the official rounding rule).
- Inline annotation (`components/EssayEditor.tsx`, TipTap): while writing,
  a plain rich-text editor; once scored, it re-renders read-only with each
  `inline_errors[]` quote highlighted in place (`lib/writing/annotate.ts`
  locates the quotes and builds the marked-up HTML) — hovering a highlight
  shows the issue, the suggested correction, and the category/rule
  violated.
- Model rewrite (`POST /api/writing/rewrite`, "Show me this paragraph at
  my target band" in the results view): rewrites one paragraph of the
  candidate's own answer at a target band (Gemini Flash, temperature 0.9,
  no grounding) — always rendered with an "AI-generated example" label and
  a copy-verbatim warning, never scored or treated as ground truth.

## Phase 3: Speaking module

A full Speaking test — Part 1 + Part 2 (cue card) + Part 3, tied together
and scored holistically (one set of 4 criterion bands for the whole test,
not a per-part score, matching real IELTS methodology).

- `POST /api/speaking/sessions/start` — generates Part 1 (10-12 Qs across
  2-3 topics), a Part 2 cue card (60s prep / up to 120s speaking), and
  Part 3 follow-ups generated FROM Part 2's topic (`lib/speaking/generateSpeakingSession.ts`).
- `components/AudioRecorder.tsx` — MediaRecorder capture with a visual
  timer; Part 2 shows a 60s prep countdown before recording starts
  automatically, then auto-stops at the 120s cap.
- `POST /api/speaking/sessions/[id]/submit-part` — uploads the recording
  (S3-compatible via `lib/storage/audioStorage.ts`, or a local-filesystem
  dev fallback when no `S3_BUCKET` is configured — served back through
  `/api/storage/audio/[...key]`), transcribes it with word-level
  timestamps + confidence (Deepgram, `lib/stt/transcribe.ts` — swappable
  behind the `SttProvider` interface), and extracts acoustic features in
  pure code (`lib/speaking/acousticFeatures.ts`: speech rate, filled
  pauses, silent pauses >0.5s, mean length of run, self-correction rate —
  fully unit tested, no external API needed).
- `POST /api/speaking/sessions/[id]/score` — the Speaking evaluator
  (`lib/scoring/evaluateSpeaking.ts`) injects the official band
  descriptors plus the code-computed acoustic metrics (as ground truth,
  never re-derived by the model) into the prompt, double-pass scores FC/LR/GRA/PR,
  and optionally passes Part 2's raw audio to Gemini (native audio input)
  for a richer Pronunciation judgment.
- Pronunciation: if `AZURE_SPEECH_KEY` is configured, a real
  phoneme-level score is used and labeled "measured"
  (`lib/speaking/pronunciation.ts`); otherwise the LLM's own audio-informed
  PR band is used and labeled "estimated" — both paths are wired, only the
  Azure integration itself is a stub (no key in scope for this phase).
- UI (`/practice/speaking`): four criterion cards (with a measured/estimated
  badge on Pronunciation), a fluency timeline overlaying filled pauses and
  silent pauses (>0.5s) directly on the transcript, a speech-rate gauge vs.
  the Band 7 target (~150 wpm), upgrade-phrase suggestions, and an
  on-demand model cue-card answer (`POST /api/speaking/model-answer`) —
  always labeled "AI-generated example."

## Docker

```bash
cp .env.example .env   # fill in GEMINI_API_KEY (and adjust POSTGRES_*/DATABASE_URL if needed)
```

### Dev (hot reload)

`docker-compose.override.yml` is loaded automatically and swaps the `app`
service to `npm run dev` with the repo bind-mounted in.

```bash
docker compose up --build          # db + migrate + app (hot reload), foreground
docker compose up --build -d       # same, detached
docker compose logs -f app         # tail app logs
docker compose down                # stop (keeps the pgdata volume)
docker compose down -v             # stop and wipe volumes (pgdata, minio-data)
```

### Prod-like (standalone runner, no bind mounts)

Skip the override explicitly:

```bash
docker compose -f docker-compose.yml up --build -d
curl -i http://localhost:3000/health   # 200 once db + gemini both check out
```

### Optional services

`redis` (job queue) and `minio` (S3-compatible object storage, later phase)
are gated behind Compose profiles and stay off otherwise:

```bash
docker compose --profile queue up -d           # adds redis
docker compose --profile storage up -d         # adds minio (console on :9001)
docker compose --profile queue --profile storage up --build -d   # everything
```

### Migrations

`migrate` runs `prisma migrate deploy` once against the `db` service and
exits; `app` won't start until it completes successfully. To run it by hand
(e.g. after adding a new migration) without restarting `app`:

```bash
docker compose run --rm migrate
```

### Rebuilding after a dependency change

```bash
docker compose build --no-cache app
docker compose up -d
```

### Useful one-offs

```bash
docker compose exec app sh                                   # shell in the running app container
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"  # psql into db
docker compose ps                                             # container + healthcheck status
```
