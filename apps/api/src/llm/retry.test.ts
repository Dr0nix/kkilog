import { ApiError } from '@google/genai';
import { describe, expect, it } from 'vitest';
import {
  GEMINI_BUDGET_MS,
  GEMINI_MAX_ATTEMPT_MS,
  GEMINI_MIN_ATTEMPT_MS,
  attemptTimeoutMs,
  retryDelayMs,
} from './retry';

// 실제 429 응답 본문 형태(분당 한도 초과)
const quota429 = (delay: string) =>
  new ApiError({
    status: 429,
    message: JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: delay }],
      },
    }),
  });

describe('retryDelayMs', () => {
  it('429면 retryDelay만큼 기다린다', () => {
    expect(retryDelayMs(quota429('17.3s'), 20_000)).toBe(17_300);
  });

  it('429인데 너무 오래 기다려야 하면 재시도하지 않는다', () => {
    expect(retryDelayMs(quota429('45s'), 20_000)).toBeNull();
  });

  it('429에 retryDelay가 없으면 바로 재시도한다', () => {
    expect(retryDelayMs(new ApiError({ status: 429, message: 'quota' }), 20_000)).toBe(0);
  });

  it('5xx·타임아웃은 바로 재시도하고, 4xx는 재시도하지 않는다', () => {
    expect(retryDelayMs(new ApiError({ status: 503, message: 'unavailable' }), 20_000)).toBe(0);
    expect(retryDelayMs(Object.assign(new Error('t'), { name: 'TimeoutError' }), 20_000)).toBe(0);
    expect(retryDelayMs(new ApiError({ status: 400, message: 'bad' }), 20_000)).toBeNull();
    expect(retryDelayMs(new Error('other'), 20_000)).toBeNull();
  });
});

describe('attemptTimeoutMs', () => {
  it('첫 시도는 한 시도 최대치', () => {
    expect(attemptTimeoutMs(0)).toBe(GEMINI_MAX_ATTEMPT_MS);
  });

  it('빨리 실패했으면(5xx 등) 남은 예산 안에서 다시 시도', () => {
    expect(attemptTimeoutMs(1_000)).toBe(Math.min(GEMINI_MAX_ATTEMPT_MS, GEMINI_BUDGET_MS - 1_000));
    expect(attemptTimeoutMs(GEMINI_BUDGET_MS - GEMINI_MIN_ATTEMPT_MS)).toBe(GEMINI_MIN_ATTEMPT_MS);
  });

  it('한 시도를 다 기다린 뒤(타임아웃)엔 남은 시간이 모자라 재시도하지 않는다', () => {
    expect(attemptTimeoutMs(GEMINI_MAX_ATTEMPT_MS)).toBeNull();
    expect(attemptTimeoutMs(GEMINI_BUDGET_MS - GEMINI_MIN_ATTEMPT_MS + 1)).toBeNull();
  });
});
