import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { attemptTimeoutMs, retryDelayMs } from '../llm/retry';

// 429 대기는 이만큼까지만. 대기 뒤에도 남은 예산이 있어야 재시도한다(attemptTimeoutMs).
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

// 구조화 출력(JSON) 한 번 호출. 429·5xx·타임아웃은 1회만 재시도하되, 호출 전체 예산(GEMINI_BUDGET_MS) 안에서만 한다(spec 6).
// 시도마다 짧게 끊지 않고 한 시도에 최대 GEMINI_MAX_ATTEMPT_MS까지 기다린다(Gemini가 느린 날 25~30초 걸림).
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
  const startedAt = Date.now();
  for (let attempt = 1; ; attempt++) {
    // 첫 시도는 늘 가능하다(경과 0). 재시도는 아래에서 예산을 확인한 뒤에만 온다.
    const timeoutMs = attemptTimeoutMs(Date.now() - startedAt) ?? 0;
    try {
      const response = await gemini().models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: args.systemInstruction,
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: args.responseJsonSchema,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
      const text = response.text;
      if (!text) throw new GeminiError('empty response');
      return { model, text, raw: { text, usage: response.usageMetadata, model_version: response.modelVersion } };
    } catch (error) {
      const waitMs = attempt === 1 ? retryDelayMs(error, MAX_RETRY_WAIT_MS) : null;
      // 기다린 뒤에도 한 번 더 시도할 시간이 남아 있을 때만 재시도한다.
      if (waitMs !== null && attemptTimeoutMs(Date.now() - startedAt + waitMs) !== null) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      if (error instanceof GeminiError) throw error;
      throw new GeminiError('gemini request failed', { cause: error });
    }
  }
}
