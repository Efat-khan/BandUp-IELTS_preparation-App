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
