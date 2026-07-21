/*
  Warnings:

  - Added the required column `evaluatorVersion` to the `scores` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "progress" ADD COLUMN     "avgTimeSpentSeconds" INTEGER,
ADD COLUMN     "evaluatorVersion" TEXT;

-- AlterTable
ALTER TABLE "scores" ADD COLUMN     "evaluatorVersion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "timeSpentSeconds" INTEGER;
