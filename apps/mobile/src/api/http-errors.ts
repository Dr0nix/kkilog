import type { ErrorCode } from '@kkilog/contracts';

// API 호출이 실패하는 경우를 종류별로 나눈다. 화면은 종류에 따라 다른 문구를 보여준다(errorText).

// 저장된(또는 확인 중인) 접속 코드가 없거나 폐기됨(401)
export class UnauthorizedError extends Error {}

// 서버가 4xx·5xx로 답함
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | undefined;

  constructor(status: number, code: ErrorCode | undefined) {
    super(`API ${status}${code ? ` ${code}` : ''}`);
    this.status = status;
    this.code = code;
  }
}

// 요청이 서버에 닿지 못함(네트워크 끊김, 타임아웃, 요청을 만드는 단계의 실패 등)
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(`network: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

// 서버가 2xx로 답했지만 JSON이 아니거나 contracts 스키마와 맞지 않음
export class ResponseParseError extends Error {}

export const NETWORK_ERROR = '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
export const PARSE_ERROR = '응답을 읽지 못했어요. 앱을 껐다 켜서 업데이트를 받아 주세요.';

// 화면에 보여줄 문구. 서버 오류엔 상태 코드를 붙여 원인을 구분할 수 있게 한다.
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return `서버 오류가 났어요 (코드 ${error.status})`;
  if (error instanceof ResponseParseError) return PARSE_ERROR;
  return NETWORK_ERROR;
}
