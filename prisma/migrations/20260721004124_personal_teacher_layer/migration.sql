-- CreateEnum
CREATE TYPE "ErrorTrend" AS ENUM ('IMPROVING', 'PERSISTENT', 'WORSENING');

-- CreateEnum
CREATE TYPE "PlanUnitStatus" AS ENUM ('PENDING', 'ACTIVE', 'MASTERED', 'INTERVENED');

-- CreateEnum
CREATE TYPE "CoachRole" AS ENUM ('LEARNER', 'TUTOR');

-- CreateTable
CREATE TABLE "learner_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetBand" DECIMAL(2,1),
    "examDate" DATE,
    "firstLanguage" TEXT,
    "criterionEstimates" JSONB,
    "narrative" TEXT,
    "diagnosticCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "Module" NOT NULL,
    "criterion" "Criterion" NOT NULL,
    "errorKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "example" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "recentCounts" JSONB,
    "trend" "ErrorTrend" NOT NULL DEFAULT 'PERSISTENT',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_summaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT,
    "module" "Module" NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "introduction" TEXT,
    "examDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plan_units" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "module" "Module" NOT NULL,
    "criterion" "Criterion" NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "status" "PlanUnitStatus" NOT NULL DEFAULT 'PENDING',
    "baselineBand" DECIMAL(3,1),
    "targetBand" DECIMAL(3,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plan_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_lessons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "errorLedgerId" TEXT NOT NULL,
    "planUnitId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mini_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT,
    "role" "CoachRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coaching_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learner_profile_userId_key" ON "learner_profile"("userId");

-- CreateIndex
CREATE INDEX "error_ledger_userId_trend_idx" ON "error_ledger"("userId", "trend");

-- CreateIndex
CREATE UNIQUE INDEX "error_ledger_userId_errorKey_key" ON "error_ledger"("userId", "errorKey");

-- CreateIndex
CREATE UNIQUE INDEX "session_summaries_submissionId_key" ON "session_summaries"("submissionId");

-- CreateIndex
CREATE INDEX "session_summaries_userId_createdAt_idx" ON "session_summaries"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "study_plan_userId_key" ON "study_plan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "study_plan_units_planId_position_key" ON "study_plan_units"("planId", "position");

-- CreateIndex
CREATE INDEX "mini_lessons_userId_idx" ON "mini_lessons"("userId");

-- CreateIndex
CREATE INDEX "coaching_messages_userId_createdAt_idx" ON "coaching_messages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "coaching_messages_submissionId_idx" ON "coaching_messages"("submissionId");

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_ledger" ADD CONSTRAINT "error_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plan" ADD CONSTRAINT "study_plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plan_units" ADD CONSTRAINT "study_plan_units_planId_fkey" FOREIGN KEY ("planId") REFERENCES "study_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_lessons" ADD CONSTRAINT "mini_lessons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_lessons" ADD CONSTRAINT "mini_lessons_errorLedgerId_fkey" FOREIGN KEY ("errorLedgerId") REFERENCES "error_ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_lessons" ADD CONSTRAINT "mini_lessons_planUnitId_fkey" FOREIGN KEY ("planUnitId") REFERENCES "study_plan_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_messages" ADD CONSTRAINT "coaching_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_messages" ADD CONSTRAINT "coaching_messages_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
