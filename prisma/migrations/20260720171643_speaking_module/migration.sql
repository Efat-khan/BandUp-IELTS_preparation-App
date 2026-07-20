-- CreateEnum
CREATE TYPE "PronunciationSource" AS ENUM ('MEASURED', 'ESTIMATED');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "cueCardPoints" JSONB,
ADD COLUMN     "part1Topics" JSONB,
ADD COLUMN     "part3FollowUps" JSONB,
ADD COLUMN     "prepSeconds" INTEGER,
ADD COLUMN     "speakingSeconds" INTEGER;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "acousticFeatures" JSONB,
ADD COLUMN     "speakingSessionId" TEXT,
ADD COLUMN     "wordTimestamps" JSONB;

-- CreateTable
CREATE TABLE "speaking_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "part1QuestionId" TEXT NOT NULL,
    "part2QuestionId" TEXT NOT NULL,
    "part3QuestionId" TEXT NOT NULL,
    "status" "MockSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "overallUnrounded" DECIMAL(5,3),
    "overallBand" DECIMAL(2,1),
    "criteria" JSONB,
    "upgradePhrases" JSONB,
    "pronunciationSource" "PronunciationSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speaking_sessions_userId_createdAt_idx" ON "speaking_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_speakingSessionId_idx" ON "submissions"("speakingSessionId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_speakingSessionId_fkey" FOREIGN KEY ("speakingSessionId") REFERENCES "speaking_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_part1QuestionId_fkey" FOREIGN KEY ("part1QuestionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_part2QuestionId_fkey" FOREIGN KEY ("part2QuestionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_part3QuestionId_fkey" FOREIGN KEY ("part3QuestionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
