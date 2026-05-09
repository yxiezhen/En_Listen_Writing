import {
  extractChatContent,
  parseJsonFromModel,
  postJson,
  shouldUseMock,
} from "@/lib/ai/http";
import { mockAudioSummary, mockOcr } from "@/lib/ai/mock";
import {
  isSttWrapperConfigured,
  transcribeWithSttWrapper,
} from "@/lib/ai/stt-wrapper";
import {
  audioSummarySchema,
  type AudioInput,
  type AudioSummary,
  type ImageInput,
} from "@/lib/ai/types";

const baseUrl = process.env.DOUBAO_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
const lasSubmitUrl =
  process.env.DOUBAO_LAS_SUBMIT_URL ??
  "https://operator.las.cn-beijing.volces.com/api/v1/submit";
const lasPollUrl =
  process.env.DOUBAO_LAS_POLL_URL ??
  "https://operator.las.cn-beijing.volces.com/api/v1/poll";
const lasOperatorId = process.env.DOUBAO_LAS_OPERATOR_ID ?? "las_asr_pro";
const lasOperatorVersion = process.env.DOUBAO_LAS_OPERATOR_VERSION ?? "v1";

export async function transcribeAudio(input: AudioInput) {
  if (isSttWrapperConfigured()) {
    return transcribeWithSttWrapper(input);
  }

  const apiKey = process.env.DOUBAO_LAS_API_KEY || process.env.DOUBAO_API_KEY || "";

  if (!apiKey) {
    throw new Error(
      "缺少豆包语音识别 Key。请配置 DOUBAO_LAS_API_KEY 或 DOUBAO_API_KEY；本地测试也可以直接粘贴真实听力转写文本。",
    );
  }

  if (!input.publicUrl || !/^https?:\/\//.test(input.publicUrl)) {
    throw new Error(
      "豆包 LAS 录音文件识别需要公网 HTTP/HTTPS 或 TOS 音频 URL。当前是本地文件，请在创建练习时粘贴真实听力转写文本，或配置 APP_PUBLIC_BASE_URL 为可公网访问的域名。",
    );
  }

  return transcribeByLas({
    apiKey,
    audioUrl: input.publicUrl,
    format: getAudioFormat(input.fileName, input.mimeType),
  });
}

export async function summarizeAudio(transcript: string): Promise<AudioSummary> {
  const apiKey = process.env.DOUBAO_API_KEY ?? "";
  const model = process.env.DOUBAO_TEXT_MODEL ?? "";

  if (shouldUseMock([apiKey, model])) {
    return mockAudioSummary();
  }

  const payload = await postJson<unknown>(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages: [
      {
        role: "system",
        content:
          "You analyze English listening passages for Chinese middle-school students. Return only valid JSON. Do not wrap it in Markdown.",
      },
      {
        role: "user",
        content: `Analyze this transcript and return only a JSON object with this exact shape:
{
  "title": "short English title",
  "topic": "main topic",
  "level": "middle-school",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "keywords": ["keyword 1", "keyword 2"],
  "idealSummary": "an ideal English summary for a middle-school student"
}

Transcript:
${transcript}`,
      },
    ],
  });

  const content = extractChatContent(payload);
  return audioSummarySchema.parse(parseJsonFromModel(content));
}

export async function recognizeWritingImage(input: ImageInput) {
  const apiKey = process.env.DOUBAO_API_KEY ?? "";
  const model = process.env.DOUBAO_VISION_MODEL ?? "";

  if (shouldUseMock([apiKey, model])) {
    return mockOcr();
  }

  const image = input.buffer.toString("base64");
  const payload = await postJson<unknown>(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Recognize the student's handwritten English composition. Return only the recognized English text, preserving sentence order.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${input.mimeType};base64,${image}`,
            },
          },
        ],
      },
    ],
  });

  return extractChatContent(payload).trim();
}

async function transcribeByLas(input: {
  apiKey: string;
  audioUrl: string;
  format: string;
}) {
  const submit = await postJson<LasSubmitResponse>(lasSubmitUrl, input.apiKey, {
    operator_id: lasOperatorId,
    operator_version: lasOperatorVersion,
    data: {
      resource: "bigasr",
      audio: {
        url: input.audioUrl,
        format: input.format,
      },
      request: {
        model_name: "bigmodel",
      },
    },
  });

  const taskId = submit.metadata?.task_id;
  if (!taskId) {
    throw new Error("豆包 LAS 语音识别提交失败：没有返回 task_id");
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await delay(2000);
    const poll = await postJson<LasPollResponse>(lasPollUrl, input.apiKey, {
      operator_id: lasOperatorId,
      operator_version: lasOperatorVersion,
      task_id: taskId,
    });

    const status = poll.metadata?.task_status;
    if (status === "COMPLETED") {
      const text = poll.data?.result?.text;
      if (!text) {
        throw new Error("豆包 LAS 语音识别完成，但没有返回文本");
      }

      return text;
    }

    if (status === "FAILED") {
      throw new Error(
        `豆包 LAS 语音识别失败：${poll.metadata?.error_msg || "未知错误"}`,
      );
    }
  }

  throw new Error("豆包 LAS 语音识别超时，请稍后重试");
}

function getAudioFormat(fileName: string, mimeType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension) {
    return extension;
  }

  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("flac")) return "flac";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  return "mp3";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LasSubmitResponse = {
  metadata?: {
    task_id?: string;
    task_status?: string;
    error_msg?: string;
  };
};

type LasPollResponse = {
  metadata?: {
    task_status?: string;
    error_msg?: string;
  };
  data?: {
    result?: {
      text?: string;
    };
  };
};
