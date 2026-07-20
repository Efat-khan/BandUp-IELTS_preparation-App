/** Maps recorded-audio MIME types to/from a file extension for storage keys. */

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
};

const EXT_TO_MIME: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
};

export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXT[normalized] ?? "bin";
}

export function mimeTypeForExtension(extension: string): string {
  return EXT_TO_MIME[extension.toLowerCase()] ?? "application/octet-stream";
}
