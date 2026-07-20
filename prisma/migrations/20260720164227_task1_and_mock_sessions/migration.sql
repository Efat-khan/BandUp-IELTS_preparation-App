-- CreateEnum
CREATE TYPE "LetterRegister" AS ENUM ('FORMAL', 'SEMI_FORMAL', 'INFORMAL');

-- CreateEnum
CREATE TYPE "MockSessionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'SCORED');

-- AlterEnum
ALTER TYPE "Criterion" ADD VALUE 'TA';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "chartSpec" JSONB,
ADD COLUMN     "letterRegister" "LetterRegister";

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "mockSessionId" TEXT;

-- CreateTable
CREATE TABLE "writing_mock_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "task1QuestionId" TEXT NOT NULL,
    "task2QuestionId" TEXT NOT NULL,
    "status" "MockSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "timeLimitSeconds" INTEGER NOT NULL DEFAULT 3600,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallUnrounded" DECIMAL(5,3),
    "overallBand" DECIMAL(2,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_mock_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "writing_mock_sessions_userId_createdAt_idx" ON "writing_mock_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_mockSessionId_idx" ON "submissions"("mockSessionId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_mockSessionId_fkey" FOREIGN KEY ("mockSessionId") REFERENCES "writing_mock_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_mock_sessions" ADD CONSTRAINT "writing_mock_sessions_task1QuestionId_fkey" FOREIGN KEY ("task1QuestionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_mock_sessions" ADD CONSTRAINT "writing_mock_sessions_task2QuestionId_fkey" FOREIGN KEY ("task2QuestionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
