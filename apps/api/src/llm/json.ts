import { z } from 'zod';

// Gemini responseJsonSchema용 JSON Schema. $schema 키는 받지 않으므로 뺀다.
export function jsonSchemaForGemini(schema: z.ZodType): Record<string, unknown> {
  const json: Record<string, unknown> = { ...z.toJSONSchema(schema) };
  delete json.$schema;
  return json;
}

// JSON 파싱 + 스키마 검증. 실패하면 null.
export function parseJsonWith<T extends z.ZodType>(schema: T, text: string): z.infer<T> | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
