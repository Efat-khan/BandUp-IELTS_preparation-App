# syntax=docker/dockerfile:1

# ---- deps -------------------------------------------------------------
# Installs the full dependency tree (incl. devDependencies — the Prisma
# CLI and TypeScript live there and are needed by builder/migrator).
FROM node:22-slim AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ------------------------------------------------------------
# Generates the Prisma client and produces the standalone Next.js build.
FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ---- migrator -----------------------------------------------------------
# One-shot image that applies pending migrations, then exits. Never runs
# the app itself; DATABASE_URL is supplied at container runtime, not baked
# in here.
FROM node:22-slim AS migrator
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runner ---------------------------------------------------------------
# Slim, non-root production image. Only the traced standalone output is
# copied in — no full node_modules, no Next.js/Prisma CLIs, no source.
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
