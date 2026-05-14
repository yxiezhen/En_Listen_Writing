import type { AudioSummary, EvaluationResult, TrainingReport } from "@/lib/ai/types";

export function mockAudioSummary(): AudioSummary {
  return {
    title: "School Reading Project",
    topic: "How a school project improves English learning habits",
    level: "middle-school",
    keyPoints: [
      "The passage talks about a school reading project.",
      "Students share books and discuss what they learn.",
      "The project helps students build confidence and better English habits.",
    ],
    keywords: ["reading project", "share books", "confidence", "English habits"],
    idealSummary: `The passage is about a school reading project. Students read and share books together, which helps them improve their English habits and become more confident.`,
    comprehensionQuestions: [
      {
        question: "What is the listening passage mainly about?",
        options: [
          "A. A school reading project",
          "B. A new sports club",
          "C. A summer travel plan",
          "D. A science competition",
        ],
        answer: "A",
      },
      {
        question: "What do students do in the project?",
        options: [
          "A. They write songs",
          "B. They share books and discuss ideas",
          "C. They take photos of the school",
          "D. They learn to cook meals",
        ],
        answer: "B",
      },
      {
        question: "How does the project help students?",
        options: [
          "A. It helps them win sports games",
          "B. It helps them build confidence and English habits",
          "C. It helps them learn math faster",
          "D. It helps them travel abroad",
        ],
        answer: "B",
      },
    ],
  };
}

export function mockOcr() {
  return "The listening is about a reading project. Students share books and they become more confidence in English.";
}

export function mockEvaluation(studentText: string): EvaluationResult {
  return {
    overallScore: 78,
    rubricScores: {
      content: 82,
      grammar: 72,
      vocabulary: 76,
      coherence: 80,
    },
    overallComment:
      "Your summary covers the main topic, but it needs more accurate grammar and a little more detail about how the project helps students.",
    issues: [
      {
        type: "GRAMMAR",
        severity: "MEDIUM",
        original: "become more confidence",
        corrected: "become more confident",
        explanation: "`Confident` is an adjective, while `confidence` is a noun.",
      },
      {
        type: "CONTENT",
        severity: "LOW",
        original: studentText,
        corrected:
          "Mention that students read, share books, and build better English habits.",
        explanation:
          "The summary should include both the activity and the learning result from the listening passage.",
      },
    ],
    sentenceNotes: [
      {
        sentence: studentText,
        note: "The meaning is understandable, but one phrase sounds unnatural.",
        suggestion: "Use `become more confident in English`.",
      },
    ],
    improvedDraft:
      "The listening passage is about a school reading project. Students read and share books together, and the project helps them build better English habits and become more confident.",
    contentCoverage: {
      covered: ["reading project", "students share books"],
      missing: ["better English habits"],
      inaccurate: [],
    },
    knowledgePoints: [
      {
        type: "GRAMMAR",
        title: "Use adjectives after become",
        original: "become more confidence",
        corrected: "become more confident",
        explanation:
          "After `become`, use an adjective to describe the subject's state.",
        example: "She became more confident after practicing every day.",
      },
      {
        type: "CONTENT",
        title: "Include both action and result in a summary",
        explanation:
          "A good listening summary should mention what happened and why it matters.",
        example:
          "Students shared books, which helped them improve their English habits.",
      },
    ],
  };
}

export function mockTrainingReport(): TrainingReport {
  return {
    title: "Listening Summary Training Report",
    subtitle: "A focused review of listening comprehension and summary writing.",
    scoreLine: "Overall score: 78/100",
    highlights: [
      "The student captured the general topic.",
      "The summary needs more complete key details.",
      "Grammar accuracy can improve with adjective/noun awareness.",
    ],
    sections: [
      {
        heading: "What Went Well",
        body: "The answer is understandable and follows the basic idea of the listening passage.",
        bullets: ["Clear main topic", "Simple sentence structure"],
      },
      {
        heading: "Main Improvement Point",
        body: "The student should include both the action and the result when summarizing a listening passage.",
        bullets: ["Mention key actions", "Mention why they matter"],
      },
    ],
    actionItems: [
      "Review adjective usage after become.",
      "Rewrite the summary with one more key detail.",
      "Collect two natural expressions from the improved draft.",
    ],
    closingNote: "Keep summaries short, accurate, and complete.",
  };
}
