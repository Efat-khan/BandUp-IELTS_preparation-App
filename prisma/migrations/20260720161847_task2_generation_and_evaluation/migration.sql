-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('ACADEMIC', 'GENERAL');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "dedupeHash" TEXT,
ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "expectedWordCount" INTEGER NOT NULL DEFAULT 250,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "requestedByUserId" TEXT,
ADD COLUMN     "testType" "TestType" NOT NULL DEFAULT 'ACADEMIC',
ADD COLUMN     "timeLimitSeconds" INTEGER NOT NULL DEFAULT 2400;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "inlineErrors" JSONB,
ADD COLUMN     "modelSelfEstimatedBand" DECIMAL(2,1);

-- CreateIndex
CREATE INDEX "questions_requestedByUserId_module_taskType_createdAt_idx" ON "questions"("requestedByUserId", "module", "taskType", "createdAt");
