import * as z from "zod";

/**
 * A structured-output schema: either a Zod schema (preferred — gives both
 * the wire schema and runtime validation) or a raw JSON Schema object.
 */
export type StructuredSchema<T> = z.ZodType<T> | Record<string, unknown>;

export function isZodSchema<T>(
  schema: StructuredSchema<T>,
): schema is z.ZodType<T> {
  return schema instanceof z.ZodType;
}

/** Convert a schema to the JSON Schema the Gemini API expects. */
export function toResponseJsonSchema<T>(
  schema: StructuredSchema<T>,
): Record<string, unknown> {
  if (isZodSchema(schema)) {
    return z.toJSONSchema(schema) as Record<string, unknown>;
  }
  return schema;
}

/**
 * Parse a structured-output response body. When a Zod schema was supplied,
 * the payload is validated at runtime, so a malformed model response fails
 * loudly here instead of corrupting scores downstream.
 */
export function parseStructuredResponse<T>(
  raw: string,
  schema: StructuredSchema<T>,
): T {
  const json: unknown = JSON.parse(raw);
  if (isZodSchema(schema)) {
    return schema.parse(json);
  }
  return json as T;
}
