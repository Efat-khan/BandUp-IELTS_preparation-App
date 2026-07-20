import { ApiError, GoogleGenAI } from "@google/genai";
import { GEMINI_ROUTING } from "./models";
import {
  parseStructuredResponse,
  toResponseJsonSchema,
  type StructuredSchema,
} from "./structured";

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

const RETRY = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 16_000,
} as const;

function isRetryable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 429 || error.status >= 500)
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exponential backoff with jitter on rate limits (429) and transient
 * server errors (5xx): 1s, 2s, 4s, 8s, then fail.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === RETRY.maxAttempts - 1) {
        throw error;
      }
      lastError = error;
      const delay = Math.min(RETRY.baseDelayMs * 2 ** attempt, RETRY.maxDelayMs);
      await sleep(delay + Math.random() * 250);
    }
  }
  throw lastError;
}

function responseText(response: { text?: string }): string {
  if (!response.text) {
    throw new Error("Gemini returned an empty response");
  }
  return response.text;
}

/**
 * Scoring call: Pro tier, temperature 0, structured output enforced via
 * responseMimeType + responseJsonSchema. Never parses JSON out of prose.
 *
 * Pass a Zod schema to get runtime validation on top of the API-side
 * schema constraint; a raw JSON Schema object is also accepted.
 */
export async function scoreWithSchema<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: StructuredSchema<T>,
): Promise<T> {
  const { model, temperature } = GEMINI_ROUTING.scoring;
  const response = await withRetry(() =>
    getClient().models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature,
        responseMimeType: "application/json",
        responseJsonSchema: toResponseJsonSchema(schema),
      },
    }),
  );
  return parseStructuredResponse(responseText(response), schema);
}

/**
 * Trivial liveness check on the cheapest tier (Flash-Lite, temperature 0).
 * Used by /health; not part of the scoring/generation paths.
 */
export async function ping(): Promise<string> {
  const { model, temperature } = GEMINI_ROUTING.precheck;
  const response = await withRetry(() =>
    getClient().models.generateContent({
      model,
      contents: "Reply with the single word: ok",
      config: { temperature },
    }),
  );
  return responseText(response);
}

/**
 * Generation call: Flash tier, temperature 0.9, Google Search grounding ON.
 * Returns free text (question prompts, sample answers, etc.).
 */
export async function generate(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const { model, temperature, searchGrounding } = GEMINI_ROUTING.generation;
  const response = await withRetry(() =>
    getClient().models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature,
        ...(searchGrounding ? { tools: [{ googleSearch: {} }] } : {}),
      },
    }),
  );
  return responseText(response);
}

/**
 * Coerces arbitrary free text into a target schema on the cheap Flash-Lite
 * tier, temperature 0, no tools. Exists because the Gemini API cannot
 * combine `tools` (e.g. Google Search grounding) with structured output in
 * a single call — `generate()` gets the grounded free text, then this
 * repairs/validates it into the exact shape callers need, instead of
 * hand-rolling brittle text parsing.
 */
export async function structureFreeText<T>(
  rawText: string,
  schema: StructuredSchema<T>,
): Promise<T> {
  const { model, temperature } = GEMINI_ROUTING.precheck;
  const response = await withRetry(() =>
    getClient().models.generateContent({
      model,
      contents: `Extract and normalize the following content into the exact \
structure required. Do not invent information that isn't present in the \
source text below; only reformat it.\n\n---\n${rawText}\n---`,
      config: {
        temperature,
        responseMimeType: "application/json",
        responseJsonSchema: toResponseJsonSchema(schema),
      },
    }),
  );
  return parseStructuredResponse(responseText(response), schema);
}
