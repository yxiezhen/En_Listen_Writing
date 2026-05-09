import { readStoredFile } from "@/lib/storage";
import { jsonError } from "@/lib/api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  try {
    const { key } = await context.params;
    const storageKey = key.join("/");
    const file = await readStoredFile(storageKey);
    return new Response(file);
  } catch (error) {
    return jsonError(error, 404);
  }
}
