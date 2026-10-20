// 서버와 운영자 스크립트(scripts/access-code.ts)가 같이 쓴다. Node로 직접 실행되므로 server-only를 붙이지 않는다.
import { ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH, normalizeAccessCode } from '@kkilog/contracts/access-code';

// 32는 256의 약수라서 바이트의 하위 5비트만 써도 문자 분포가 균일하다.
export function generateAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ACCESS_CODE_LENGTH));
  return Array.from(bytes, (b) => ACCESS_CODE_ALPHABET.charAt(b & 31)).join('');
}

// 정규화한 코드의 SHA-256(hex). DB엔 decode(hash, 'hex')로 bytea 저장·비교한다.
export async function hashAccessCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// "Authorization: Bearer <코드>"에서 정규화한 코드를 꺼낸다. 없거나 형식이 틀리면 null.
export function parseBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S.*)$/i);
  return match?.[1] ? normalizeAccessCode(match[1]) : null;
}
