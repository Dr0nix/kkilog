import { router } from 'expo-router';
import { ApiError, UnauthorizedError, errorText } from './http-errors';

export { NETWORK_ERROR } from './http-errors';

// 화면에 오류 문구를 보여줄 상황이면 true. 401(client가 코드 입력 화면으로 보냄)과
// 프로필 없음(온보딩으로 보냄)은 화면 이동으로 처리하고 false.
export function shouldShowError(e: unknown): boolean {
  if (e instanceof UnauthorizedError) return false;
  if (e instanceof ApiError && e.code === 'ONBOARDING_REQUIRED') {
    router.replace('/onboarding');
    return false;
  }
  return true;
}

// 보여줄 오류 문구(종류별: 연결 실패 / 서버 오류 + 상태 코드 / 응답 해석 실패). 화면 이동으로 처리했으면 null.
export function errorMessage(e: unknown): string | null {
  return shouldShowError(e) ? errorText(e) : null;
}
