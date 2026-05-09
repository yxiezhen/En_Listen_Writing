import { requireCurrentUser } from "@/lib/auth";
import { requireFile, requireText, jsonError } from "@/lib/api";
import { transcribeAudio, summarizeAudio } from "@/lib/ai/doubao";
import { prisma } from "@/lib/prisma";
import { readStoredFile, saveUpload } from "@/lib/storage";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const exercises = await prisma.listeningExercise.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        submissions: {
          include: { evaluation: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return Response.json({ exercises });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    if (user.role !== "ADMIN" && !user.isVip) {
      const exerciseCount = await prisma.listeningExercise.count({
        where: { userId: user.id },
      });

      if (exerciseCount >= 1) {
        return Response.json(
          { error: "非 VIP 学生只能创建 1 篇听力练习。请联系管理员开通 VIP 后继续上传。" },
          { status: 403 },
        );
      }
    }

    const formData = await request.formData();
    const title = requireText(formData.get("title"), "title");
    const audio = requireFile(formData.get("audio"), "audio");
    const providedTranscript = getOptionalText(formData.get("transcript"));

    if (!audio.type.startsWith("audio/")) {
      return Response.json({ error: "Only audio files are supported" }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "Audio file is too large" }, { status: 400 });
    }

    const stored = await saveUpload(audio, ["users", user.id, "audio"]);
    const buffer = await readStoredFile(stored.key);
    const transcript =
      providedTranscript ??
      (await transcribeAudio({
        buffer,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        publicUrl: buildPublicUrl(stored.url),
      }));
    const summary = await summarizeAudio(transcript);

    const exercise = await prisma.listeningExercise.create({
      data: {
        userId: user.id,
        title,
        audioFileName: stored.fileName,
        audioStorageKey: stored.key,
        audioMimeType: stored.mimeType,
        transcript,
        summary,
      },
    });

    return Response.json({ exercise }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

function buildPublicUrl(path: string) {
  const baseUrl = process.env.APP_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}${path}` : undefined;
}

function getOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
