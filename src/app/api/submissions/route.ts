import { z } from "zod";
import { evaluateWriting } from "@/lib/ai/deepseek";
import { jsonError } from "@/lib/api";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audioSummarySchema } from "@/lib/ai/types";

const submissionSchema = z.object({
  exerciseId: z.string().min(1),
  text: z.string().min(20).max(5000),
  mode: z.enum(["TEXT", "PHOTO"]).default("TEXT"),
  ocrText: z.string().optional(),
  imageStorageKey: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const payload = submissionSchema.parse(await request.json());
    const exercise = await prisma.listeningExercise.findFirst({
      where: { id: payload.exerciseId, userId: user.id },
    });

    if (!exercise) {
      return Response.json({ error: "Exercise not found" }, { status: 404 });
    }

    const audioSummary = audioSummarySchema.parse(exercise.summary);
    const evaluation = await evaluateWriting({
      transcript: exercise.transcript,
      audioSummary,
      studentText: payload.text,
    });

    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.writingSubmission.create({
        data: {
          userId: user.id,
          exerciseId: exercise.id,
          mode: payload.mode,
          originalText: payload.text,
          ocrText: payload.ocrText,
          imageStorageKey: payload.imageStorageKey,
        },
      });

      const savedEvaluation = await tx.evaluation.create({
        data: {
          userId: user.id,
          submissionId: submission.id,
          overallScore: evaluation.overallScore,
          rubricScores: evaluation.rubricScores,
          overallComment: evaluation.overallComment,
          issues: evaluation.issues,
          sentenceNotes: evaluation.sentenceNotes,
          improvedDraft: evaluation.improvedDraft,
          contentCoverage: evaluation.contentCoverage,
          rawModelOutput: evaluation,
        },
      });

      await tx.knowledgePoint.createMany({
        data: evaluation.knowledgePoints.map((point) => ({
          userId: user.id,
          evaluationId: savedEvaluation.id,
          type: point.type,
          title: point.title,
          original: point.original,
          corrected: point.corrected,
          explanation: point.explanation,
          example: point.example,
        })),
      });

      return tx.writingSubmission.findUniqueOrThrow({
        where: { id: submission.id },
        include: {
          exercise: true,
          evaluation: {
            include: {
              knowledgePoints: true,
            },
          },
        },
      });
    });

    return Response.json({ submission: result }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
