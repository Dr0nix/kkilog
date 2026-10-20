import { router } from 'expo-router';
import { ApiError, UnauthorizedError } from './client';

export const NETWORK_ERROR = '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';

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
