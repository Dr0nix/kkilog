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

// Gemini 호출 한 번(재시도 포함)에 쓸 수 있는 시간. 라우트 maxDuration(60초)에서 업로드·DB·응답 몫을 남긴다.
// Gemini가 느린 날엔 한 번에 25~30초씩 걸려서(2026-10-21 측정), 시도마다 짧게 끊으면 재시도까지 전부 실패한다.
export const GEMINI_BUDGET_MS = 50_000;
export const GEMINI_MAX_ATTEMPT_MS = 45_000;
// 남은 시간이 이보다 적으면 다시 시도해 봐야 응답을 못 받으므로 재시도하지 않는다.
export const GEMINI_MIN_ATTEMPT_MS = 15_000;

// 이번 시도의 타임아웃(ms). 지금까지 elapsedMs를 썼을 때 남은 예산으로 정하고, 모자라면 null(시도하지 않음).
export function attemptTimeoutMs(elapsedMs: number): number | null {
  const remaining = GEMINI_BUDGET_MS - elapsedMs;
  if (remaining < GEMINI_MIN_ATTEMPT_MS) return null;
  return Math.min(GEMINI_MAX_ATTEMPT_MS, remaining);
}
