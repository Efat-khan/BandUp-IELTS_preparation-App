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
