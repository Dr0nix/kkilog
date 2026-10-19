import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { retryDelayMs } from '../llm/retry';

// 시도 2번 + 429 대기 1번이 라우트 maxDuration(60초) 안에 들어가게 잡는다.
const TIMEOUT_MS = 18_000;
const MAX_RETRY_WAIT_MS = 20_000;

let client: GoogleGenAI | undefined;

function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// 모델은 환경변수로만 지정한다(CLAUDE.md).
export function geminiModel(): string {
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new Error('GEMINI_MODEL is not set');
  return model;
}

export class GeminiError extends Error {}

export type GeminiJsonResult = {
  model: string;
  text: string;
  // DB의 raw_response에 그대로 저장한다.
  raw: { text: string; usage: unknown; model_version: string | undefined };
};

export type GeminiImage = { mimeType: string; base64: string };

// 구조화 출력(JSON) 한 번 호출. 429·5xx·타임아웃은 1회만 재시도한다(spec 6).
// input은 JSON 문자열로, images는 그 앞에 붙여 보낸다.
export async function generateJson(args: {
  systemInstruction: string;
  input: unknown;
  images?: readonly GeminiImage[];
  responseJsonSchema: unknown;
}): Promise<GeminiJsonResult> {
  const model = geminiModel();
  const parts = [
    ...(args.images ?? []).map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.base64 } })),
    { text: JSON.stringify(args.input) },
  ];
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await gemini().models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: args.systemInstruction,
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: args.responseJsonSchema,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      const text = response.text;
      if (!text) throw new GeminiError('empty response');
      return { model, text, raw: { text, usage: response.usageMetadata, model_version: response.modelVersion } };
    } catch (error) {
      const waitMs = attempt === 1 ? retryDelayMs(error, MAX_RETRY_WAIT_MS) : null;
      if (waitMs !== null) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      if (error instanceof GeminiError) throw error;
      throw new GeminiError('gemini request failed', { cause: error });
    }
  }
}
