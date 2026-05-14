import { z } from "zod";

export const audioSummarySchema = z.object({
  title: z.string(),
  topic: z.string(),
  level: z.string(),
  keyPoints: z.array(z.string()),
  keywords: z.array(z.string()),
  idealSummary: z.string(),
  comprehensionQuestions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        answer: z.enum(["A", "B", "C", "D"]),
      }),
    )
    .max(5)
    .default([]),
});

export const evaluationSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  rubricScores: z.object({
    content: z.number().int().min(0).max(100),
    grammar: z.number().int().min(0).max(100),
    vocabulary: z.number().int().min(0).max(100),
    coherence: z.number().int().min(0).max(100),
  }),
  overallComment: z.string(),
  issues: z.array(
    z.object({
      type: z.enum([
        "SPELLING",
        "GRAMMAR",
        "CONTENT",
        "VOCABULARY",
        "CHINESE_ENGLISH",
        "EXPRESSION",
        "LISTENING",
      ]),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
      original: z.string(),
      corrected: z.string(),
      explanation: z.string(),
    }),
  ),
  sentenceNotes: z.array(
    z.object({
      sentence: z.string(),
      note: z.string(),
      suggestion: z.string(),
    }),
  ),
  improvedDraft: z.string(),
  contentCoverage: z.object({
    covered: z.array(z.string()),
    missing: z.array(z.string()),
    inaccurate: z.array(z.string()),
  }),
  knowledgePoints: z.array(
    z.object({
      type: z.enum([
        "SPELLING",
        "GRAMMAR",
        "CONTENT",
        "VOCABULARY",
        "CHINESE_ENGLISH",
        "EXPRESSION",
        "LISTENING",
      ]),
      title: z.string(),
      original: z.string().optional(),
      corrected: z.string().optional(),
      explanation: z.string(),
      example: z.string().optional(),
    }),
  ),
});

export const trainingReportSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  scoreLine: z.string(),
  highlights: z.array(z.string()),
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string(),
      bullets: z.array(z.string()).optional(),
    }),
  ),
  actionItems: z.array(z.string()),
  closingNote: z.string(),
});

export type AudioSummary = z.infer<typeof audioSummarySchema>;
export type EvaluationResult = z.infer<typeof evaluationSchema>;
export type TrainingReport = z.infer<typeof trainingReportSchema>;

export type AudioInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  publicUrl?: string;
};

export type ImageInput = {
  buffer: Buffer;
  mimeType: string;
};
