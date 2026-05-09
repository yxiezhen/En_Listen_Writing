import { requireCurrentUser } from "@/lib/auth";
import { requireFile, jsonError } from "@/lib/api";
import { recognizeWritingImage } from "@/lib/ai/doubao";
import { readStoredFile, saveUpload } from "@/lib/storage";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const formData = await request.formData();
    const image = requireFile(formData.get("image"), "image");

    if (!image.type.startsWith("image/")) {
      return Response.json({ error: "Only image files are supported" }, { status: 400 });
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image file is too large" }, { status: 400 });
    }

    const stored = await saveUpload(image, ["users", user.id, "writing-images"]);
    const buffer = await readStoredFile(stored.key);
    const ocrText = await recognizeWritingImage({
      buffer,
      mimeType: stored.mimeType,
    });

    return Response.json({ ocrText, imageStorageKey: stored.key, imageUrl: stored.url });
  } catch (error) {
    return jsonError(error);
  }
}
