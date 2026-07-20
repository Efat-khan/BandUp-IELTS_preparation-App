import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Serves audio uploaded via LocalFilesystemStorageProvider (the dev
 * fallback used when no S3_BUCKET is configured — see
 * lib/storage/audioStorage.ts). Not used when S3StorageProvider is active,
 * since that returns a direct S3/MinIO URL instead.
 */
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), "storage", "audio");

const CONTENT_TYPES: Record<string, string> = {
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const filePath = path.join(LOCAL_STORAGE_DIR, ...key);

  // Defend against path traversal — the resolved path must stay inside LOCAL_STORAGE_DIR.
  if (filePath !== LOCAL_STORAGE_DIR && !filePath.startsWith(LOCAL_STORAGE_DIR + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(data), { headers: { "Content-Type": contentType } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
