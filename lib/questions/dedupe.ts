import { createHash } from "node:crypto";

/** Lowercase, strip punctuation, collapse whitespace — so trivial rephrasing still hashes the same. */
export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** sha256(normalized topic_tag + "|" + normalized prompt), used to de-dup against a user's recent questions. */
export function computeQuestionDedupeHash(topicTag: string, prompt: string): string {
  const normalized = `${normalizeForHash(topicTag)}|${normalizeForHash(prompt)}`;
  return createHash("sha256").update(normalized).digest("hex");
}

export function isDuplicateQuestion(hash: string, recentHashes: Iterable<string>): boolean {
  for (const existing of recentHashes) {
    if (existing === hash) return true;
  }
  return false;
}
