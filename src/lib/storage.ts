import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const uploadRoot = process.env.UPLOAD_ROOT
  ? path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_ROOT)
  : path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");

export type StoredFile = {
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export async function saveUpload(
  file: File,
  segments: string[],
): Promise<StoredFile> {
  const safeName = sanitizeFileName(file.name || "upload.bin");
  const key = path.posix.join(...segments.map(sanitizeSegment), `${Date.now()}-${safeName}`);
  const diskPath = resolveStoragePath(key);

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));

  return {
    key,
    url: `/api/files/${key}`,
    fileName: safeName,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function readStoredFile(key: string) {
  const diskPath = resolveStoragePath(key);
  return readFile(diskPath);
}

export async function deleteStoredFile(key: string) {
  const diskPath = resolveStoragePath(key);
  await rm(diskPath, { force: true });
}

export function resolveStoragePath(key: string) {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  const diskPath = path.resolve(uploadRoot, normalized);

  if (!diskPath.startsWith(uploadRoot)) {
    throw new Error("Invalid storage key");
  }

  return diskPath;
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "file";
}

function sanitizeFileName(value: string) {
  const parsed = path.parse(value);
  const base = sanitizeSegment(parsed.name);
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
  return `${base}${ext}`;
}
