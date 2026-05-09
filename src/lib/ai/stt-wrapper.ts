import { postMultipart } from "@/lib/ai/http";
import type { AudioInput } from "@/lib/ai/types";

const sttBaseUrl = process.env.STT_WRAPPER_BASE_URL?.replace(/\/$/, "");
const sttTranscribePath = process.env.STT_WRAPPER_TRANSCRIBE_PATH ?? "/stt/transcribe";
const sttModel =
  process.env.STT_WRAPPER_MODEL ?? "Systran/faster-whisper-small";

export function isSttWrapperConfigured() {
  return Boolean(sttBaseUrl);
}

export async function transcribeWithSttWrapper(input: AudioInput) {
  if (!sttBaseUrl) {
    throw new Error("STT Wrapper base URL is not configured");
  }

  const apiKey = process.env.STT_WRAPPER_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("缺少 STT_WRAPPER_API_KEY。请把 Speaches/STT Wrapper 的 API Key 填到 .env。");
  }

  const arrayBuffer = input.buffer.buffer.slice(
    input.buffer.byteOffset,
    input.buffer.byteOffset + input.buffer.byteLength,
  ) as ArrayBuffer;
  const formData = new FormData();
  formData.set("model", sttModel);
  formData.set(
    "file",
    new Blob([arrayBuffer], { type: input.mimeType }),
    input.fileName,
  );

  const endpoint = `${sttBaseUrl}${sttTranscribePath}`;
  const response = await postMultipart<SttWrapperResponse>(
    endpoint,
    apiKey,
    formData,
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`STT Wrapper 转写失败：${endpoint} 无法完成请求。${message}`);
  });

  if (!response.text?.trim()) {
    throw new Error("STT Wrapper 没有返回转写文本");
  }

  return response.text.trim();
}

type SttWrapperResponse = {
  text?: string;
  language?: string;
  language_probability?: number;
  duration?: number;
  elapsed_seconds?: number;
  model?: string;
};
