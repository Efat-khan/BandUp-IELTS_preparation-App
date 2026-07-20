import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Object storage abstraction for recorded audio. S3StorageProvider works
 * against any S3-compatible endpoint (AWS S3, Cloudflare R2, MinIO — the
 * docker-compose "storage" profile from Phase 0). When no S3_BUCKET is
 * configured, LocalFilesystemStorageProvider is used automatically as a
 * dev fallback — it needs no external service at all, so uploads can be
 * exercised for real without any credentials.
 */

export interface UploadResult {
  url: string;
  key: string;
}

export interface StorageProvider {
  upload(key: string, data: Buffer, contentType: string): Promise<UploadResult>;
  /** Re-reads previously uploaded audio — used to pass raw audio to Gemini for native-audio Pronunciation judgment. */
  download(key: string): Promise<Buffer>;
}

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), "storage", "audio");

export class LocalFilesystemStorageProvider implements StorageProvider {
  async upload(key: string, data: Buffer): Promise<UploadResult> {
    const filePath = path.join(LOCAL_STORAGE_DIR, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return { url: `/api/storage/audio/${key}`, key };
  }

  async download(key: string): Promise<Buffer> {
    return readFile(path.join(LOCAL_STORAGE_DIR, key));
  }
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must all be set to use S3StorageProvider",
      );
    }

    this.bucket = bucket;
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
    this.client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? "auto",
      credentials: { accessKeyId, secretAccessKey },
      // Path-style addressing is required by MinIO and most non-AWS S3-compatible endpoints.
      forcePathStyle: Boolean(endpoint),
    });
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    );
    const url = this.publicBaseUrl
      ? `${this.publicBaseUrl}/${key}`
      : `${process.env.S3_ENDPOINT ?? ""}/${this.bucket}/${key}`;
    return { url, key };
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`S3 object ${key} has no body`);
    }
    return Buffer.from(bytes);
  }
}

export function getStorageProvider(): StorageProvider {
  if (process.env.S3_BUCKET) {
    return new S3StorageProvider();
  }
  return new LocalFilesystemStorageProvider();
}
