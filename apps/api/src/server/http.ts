import 'server-only';
import type { ErrorCode, ErrorResponse } from '@kkilog/contracts';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

// 개인 데이터 응답은 전부 이걸로 보낸다.
export function privateJson<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

export function errorJson(code: ErrorCode, status: number): Response {
  return privateJson<ErrorResponse>({ error: { code } }, status);
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
}
