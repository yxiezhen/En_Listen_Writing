import {
  extractChatContent,
  parseJsonFromModel,
  postJson,
  shouldUseMock,
} from "@/lib/ai/http";
import { mockEvaluation, mockTrainingReport } from "@/lib/ai/mock";
import {
  evaluationSchema,
  trainingReportSchema,
  type AudioSummary,
  type EvaluationResult,
  type TrainingReport,
} from "@/lib/ai/types";

const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export async function evaluateWriting(input: {
  transcript: string;
  audioSummary: AudioSummary;
  studentText: string;
}): Promise<EvaluationResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";

  if (shouldUseMock([apiKey])) {
    return mockEvaluation(input.studentText);
  }

  const payload = await postJson<unknown>(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are an expert English writing coach for Chinese middle-school students. Grade listening summaries against the source passage. Return only valid JSON. Do not wrap it in Markdown.",
      },
      {
        role: "user",
        content: buildEvaluationPrompt(input),
      },
    ],
  });

  const content = extractChatContent(payload);
  return evaluationSchema.parse(parseJsonFromModel(content));
}

export async function generateTrainingReport(input: {
  exerciseTitle: string;
  transcript: string;
  audioSummary: AudioSummary;
  studentText: string;
  evaluation: EvaluationResult;
}): Promise<TrainingReport> {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";

  if (shouldUseMock([apiKey])) {
    return mockTrainingReport();
  }

  const payload = await postJson<unknown>(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages: [
      {
        role: "system",
        content:
          "You create compact one-page A4 English learning reports for Chinese middle-school students. Be concise enough to print on a single page. Return only valid JSON. Do not wrap it in Markdown.",
      },
      {
        role: "user",
        content: buildReportPrompt(input),
      },
    ],
  });

  const content = extractChatContent(payload);
  return trainingReportSchema.parse(parseJsonFromModel(content));
}

function buildEvaluationPrompt(input: {
  transcript: string;
  audioSummary: AudioSummary;
  studentText: string;
}) {
  return `Evaluate the student's English listening summary.

Return JSON with this exact shape:
{
  "overallScore": 0-100,
  "rubricScores": { "content": 0-100, "grammar": 0-100, "vocabulary": 0-100, "coherence": 0-100 },
  "overallComment": "student-friendly feedback",
  "issues": [
    { "type": "SPELLING|GRAMMAR|CONTENT|VOCABULARY|CHINESE_ENGLISH|EXPRESSION|LISTENING", "severity": "LOW|MEDIUM|HIGH", "original": "...", "corrected": "...", "explanation": "..." }
  ],
  "sentenceNotes": [
    { "sentence": "...", "note": "...", "suggestion": "..." }
  ],
  "improvedDraft": "...",
  "contentCoverage": { "covered": ["..."], "missing": ["..."], "inaccurate": ["..."] },
  "knowledgePoints": [
    { "type": "SPELLING|GRAMMAR|CONTENT|VOCABULARY|CHINESE_ENGLISH|EXPRESSION|LISTENING", "title": "...", "original": "...", "corrected": "...", "explanation": "...", "example": "..." }
  ]
}

Focus on spelling, grammar, incomplete or inaccurate content, word choice, Chinglish expressions, and better natural English.

Listening transcript:
${input.transcript}

Listening key points:
${input.audioSummary.keyPoints.map((point) => `- ${point}`).join("\n")}

Ideal summary:
${input.audioSummary.idealSummary}

Student summary:
${input.studentText}`;
}

function buildReportPrompt(input: {
  exerciseTitle: string;
  transcript: string;
  audioSummary: AudioSummary;
  studentText: string;
  evaluation: EvaluationResult;
}) {
  return `Create a compact A4 one-page training report for this listening-summary exercise.

Return JSON with this exact shape:
{
  "title": "report title",
  "subtitle": "short context",
  "scoreLine": "Overall score: xx/100",
  "highlights": ["exactly 3 concise highlights, max 16 words each"],
  "sections": [
    { "heading": "...", "body": "max 55 words", "bullets": ["max 2 bullets, max 12 words each"] }
  ],
  "actionItems": ["exactly 4 next actions, max 12 words each"],
  "closingNote": "one short encouragement sentence"
}

Use 2 or 3 sections only. Choose the best organization for this specific exercise. Keep the total report concise enough for one A4 page. Focus on listening comprehension, content coverage, grammar, vocabulary, Chinglish, and review points.

Exercise title:
${input.exerciseTitle}

Listening transcript:
${input.transcript}

Listening key points:
${input.audioSummary.keyPoints.map((point) => `- ${point}`).join("\n")}

Student answer:
${input.studentText}

Evaluation JSON:
${JSON.stringify(input.evaluation)}`;
}
