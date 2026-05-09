ALTER TABLE "Evaluation"
ADD COLUMN "trainingReport" JSONB,
ADD COLUMN "trainingReportGeneratedAt" TIMESTAMP(3);
