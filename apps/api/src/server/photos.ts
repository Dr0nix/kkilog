import 'server-only';
import { del, get, issueSignedToken, presignUrl, put } from '@vercel/blob';

// 앱에 내려주는 사진 서명 URL의 유효 시간(spec 5 "짧게 유효한 서명 URL").
const SIGNED_URL_TTL_MS = 10 * 60 * 1000;

// DB엔 pathname만 저장한다(URL 아님, spec 5). position은 사진 순서(0이 대표).
// 0005 전에 올린 사진은 meals/{user_id}/{entry_id}.jpg로 남아 있다(DB에 경로가 그대로 있어 문제없음).
export function mealPhotoPathname(userId: string, entryId: string, position: number): string {
  return `meals/${userId}/${entryId}-${position}.jpg`;
}

export async function uploadMealPhoto(pathname: string, photo: Blob): Promise<void> {
  await put(pathname, photo, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false });
}

export async function deletePhoto(pathname: string): Promise<void> {
  await del(pathname);
}

// 그 사진 하나만 읽을 수 있고 SIGNED_URL_TTL_MS 뒤 만료되는 URL.
export async function signedPhotoUrl(pathname: string): Promise<string> {
  const validUntil = Date.now() + SIGNED_URL_TTL_MS;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  return presignedUrl;
}

// 재분석할 때 Gemini에 다시 보내려고 원본을 읽는다.
export async function readPhotoBase64(pathname: string): Promise<string> {
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) throw new Error(`photo not found: ${pathname}`);
  return Buffer.from(await new Response(result.stream).arrayBuffer()).toString('base64');
}
