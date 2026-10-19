import { ApiError } from '@google/genai';

// Gemini 오류를 재시도하기 전에 기다릴 시간(ms). 재시도할 오류가 아니거나 maxWaitMs보다 오래 기다려야 하면 null.
// 무료 티어는 분당 요청 수 한도가 작아서, 429면 응답의 retryDelay만큼 기다렸다가 다시 보낸다.
export function retryDelayMs(error: unknown, maxWaitMs: number): number | null {
  if (error instanceof ApiError) {
    if (error.status >= 500) return 0;
    if (error.status !== 429) return null;
    const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(error.message);
    const waitMs = match?.[1] ? Math.ceil(Number(match[1]) * 1000) : 0;
    return waitMs <= maxWaitMs ? waitMs : null;
  }
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 0 : null;
}
