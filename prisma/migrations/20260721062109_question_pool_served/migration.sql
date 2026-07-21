-- CreateTable
CREATE TABLE "question_served" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_served_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_served_userId_questionId_idx" ON "question_served"("userId", "questionId");

-- CreateIndex
CREATE INDEX "question_served_questionId_idx" ON "question_served"("questionId");

-- AddForeignKey
ALTER TABLE "question_served" ADD CONSTRAINT "question_served_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_served" ADD CONSTRAINT "question_served_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
