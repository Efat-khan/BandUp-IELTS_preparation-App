-- CreateEnum
CREATE TYPE "Module" AS ENUM ('WRITING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('WRITING_TASK1_ACADEMIC', 'WRITING_TASK1_GENERAL', 'WRITING_TASK2', 'SPEAKING_PART1', 'SPEAKING_PART2', 'SPEAKING_PART3');

-- CreateEnum
CREATE TYPE "Criterion" AS ENUM ('TR', 'CC', 'LR', 'GRA', 'FC', 'PR');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('SEED', 'GENERATED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SCORING', 'SCORED', 'FLAGGED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('STRENGTHS', 'IMPROVEMENTS', 'REWRITE', 'EXAMINER_COMMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "authProviderId" TEXT,
    "targetBand" DECIMAL(2,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "module" "Module" NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "topic" TEXT,
    "source" "QuestionSource" NOT NULL DEFAULT 'GENERATED',
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "module" "Module" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "answerText" TEXT,
    "wordCount" INTEGER,
    "audioUrl" TEXT,
    "transcript" TEXT,
    "durationSeconds" INTEGER,
    "overallUnrounded" DECIMAL(5,3),
    "overallBand" DECIMAL(2,1),
    "wordCountPenaltyApplied" BOOLEAN NOT NULL DEFAULT false,
    "disagreementFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "pass" INTEGER NOT NULL DEFAULT 1,
    "criterion" "Criterion" NOT NULL,
    "score" DECIMAL(3,1) NOT NULL,
    "evidence" JSONB NOT NULL,
    "modelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "criterion" "Criterion",
    "kind" "FeedbackKind" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "Module" NOT NULL,
    "date" DATE NOT NULL,
    "submissionsCount" INTEGER NOT NULL DEFAULT 0,
    "avgOverall" DECIMAL(5,3),
    "criterionAverages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_authProviderId_key" ON "users"("authProviderId");

-- CreateIndex
CREATE INDEX "questions_module_taskType_idx" ON "questions"("module", "taskType");

-- CreateIndex
CREATE INDEX "submissions_userId_createdAt_idx" ON "submissions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scores_submissionId_pass_criterion_key" ON "scores"("submissionId", "pass", "criterion");

-- CreateIndex
CREATE INDEX "feedback_submissionId_idx" ON "feedback"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "progress_userId_module_date_key" ON "progress"("userId", "module", "date");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
