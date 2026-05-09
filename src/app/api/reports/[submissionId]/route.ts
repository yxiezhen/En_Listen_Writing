import { generateTrainingReport } from "@/lib/ai/deepseek";
import {
  audioSummarySchema,
  evaluationSchema,
  trainingReportSchema,
  type TrainingReport,
} from "@/lib/ai/types";
import { jsonError } from "@/lib/api";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reportGenerationLocks = new Map<string, Promise<TrainingReport>>();

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  try {
    const user = await requireCurrentUser();
    const { submissionId } = await context.params;
    const submission = await prisma.writingSubmission.findFirst({
      where: {
        id: submissionId,
        userId: user.id,
      },
      include: {
        exercise: true,
        evaluation: {
          include: { knowledgePoints: true },
        },
      },
    });

    if (!submission?.evaluation) {
      return Response.json({ error: "Submission or evaluation not found" }, { status: 404 });
    }

    const savedEvaluation = submission.evaluation;
    const cachedReport = savedEvaluation.trainingReport
      ? trainingReportSchema.safeParse(savedEvaluation.trainingReport)
      : null;

    if (cachedReport?.success) {
      return Response.json({
        report: cachedReport.data,
        cached: true,
        generatedAt: savedEvaluation.trainingReportGeneratedAt,
        submission,
      });
    }

    const runningGeneration = reportGenerationLocks.get(savedEvaluation.id);
    if (runningGeneration) {
      const report = await runningGeneration;
      return Response.json({
        report,
        cached: true,
        generatedAt: savedEvaluation.trainingReportGeneratedAt,
        submission,
      });
    }

    const audioSummary = audioSummarySchema.parse(submission.exercise.summary);
    const evaluation = evaluationSchema.parse(savedEvaluation.rawModelOutput);
    const generatedAt = new Date();
    const reportPromise = generateTrainingReport({
        exerciseTitle: submission.exercise.title,
        transcript: submission.exercise.transcript,
        audioSummary,
        studentText: submission.originalText,
        evaluation,
      }).then(async (report) => {
        await prisma.evaluation.update({
          where: { id: savedEvaluation.id },
          data: {
            trainingReport: report,
            trainingReportGeneratedAt: generatedAt,
          },
        });

        return report;
      });

    reportGenerationLocks.set(savedEvaluation.id, reportPromise);

    try {
      const report = await reportPromise;

      return Response.json({
        report,
        cached: false,
        generatedAt,
        submission,
      });
    } finally {
      if (reportGenerationLocks.get(savedEvaluation.id) === reportPromise) {
        reportGenerationLocks.delete(savedEvaluation.id);
      }
    }
  } catch (error) {
    return jsonError(error);
  }
}
