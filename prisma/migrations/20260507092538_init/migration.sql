-- CreateEnum
CREATE TYPE "SubmissionMode" AS ENUM ('TEXT', 'PHOTO');

-- CreateEnum
CREATE TYPE "KnowledgePointType" AS ENUM ('SPELLING', 'GRAMMAR', 'CONTENT', 'VOCABULARY', 'CHINESE_ENGLISH', 'EXPRESSION', 'LISTENING');

-- CreateEnum
CREATE TYPE "MasteryStatus" AS ENUM ('NEW', 'REVIEWING', 'MASTERED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningExercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audioFileName" TEXT NOT NULL,
    "audioStorageKey" TEXT NOT NULL,
    "audioMimeType" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "mode" "SubmissionMode" NOT NULL,
    "originalText" TEXT NOT NULL,
    "ocrText" TEXT,
    "imageStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "rubricScores" JSONB NOT NULL,
    "overallComment" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "sentenceNotes" JSONB NOT NULL,
    "improvedDraft" TEXT NOT NULL,
    "contentCoverage" JSONB NOT NULL,
    "rawModelOutput" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "type" "KnowledgePointType" NOT NULL,
    "title" TEXT NOT NULL,
    "original" TEXT,
    "corrected" TEXT,
    "explanation" TEXT NOT NULL,
    "example" TEXT,
    "masteryStatus" "MasteryStatus" NOT NULL DEFAULT 'NEW',
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL,
    "knowledgePointId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "answer" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ListeningExercise_userId_createdAt_idx" ON "ListeningExercise"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WritingSubmission_userId_createdAt_idx" ON "WritingSubmission"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WritingSubmission_exerciseId_idx" ON "WritingSubmission"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_submissionId_key" ON "Evaluation"("submissionId");

-- CreateIndex
CREATE INDEX "Evaluation_userId_createdAt_idx" ON "Evaluation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgePoint_userId_type_idx" ON "KnowledgePoint"("userId", "type");

-- CreateIndex
CREATE INDEX "KnowledgePoint_userId_masteryStatus_idx" ON "KnowledgePoint"("userId", "masteryStatus");

-- AddForeignKey
ALTER TABLE "ListeningExercise" ADD CONSTRAINT "ListeningExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ListeningExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "WritingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePoint" ADD CONSTRAINT "KnowledgePoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePoint" ADD CONSTRAINT "KnowledgePoint_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_knowledgePointId_fkey" FOREIGN KEY ("knowledgePointId") REFERENCES "KnowledgePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
