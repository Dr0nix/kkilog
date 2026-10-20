import { z } from 'zod';

export const ERROR_CODES = [
  'UNAUTHORIZED', // 401 없거나 폐기된 접속 코드
  'ONBOARDING_REQUIRED', // 409 프로필이 필요한 API인데 프로필 없음
  'PROFILE_EXISTS', // 409 이미 온보딩함
  'ANALYSIS_REQUIRED', // 409 조언을 받으려면 ok 분석이 있어야 함
  'NOT_FOUND', // 404 없는 리소스와 남의 리소스
  'INVALID_REQUEST', // 400 요청 형식 오류
  'UPSTREAM_UNAVAILABLE', // 503 Gemini 실패. 잠시 후 재시도 가능
] as const;

export const ErrorResponseSchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES) }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ErrorCode = (typeof ERROR_CODES)[number];
