import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 앱이 edge-to-edge로 그려져서 상태 바·내비게이션 바 밑까지 화면이 깔린다.
// 상태 바(위)는 루트 레이아웃이 고정된 흰 띠로 비켜 주므로(app/_layout.tsx), 여기선 기본 여백만 둔다.
// 아래는 내비게이션 바 높이(inset)를 더해 겹치지 않게 한다.
export function useScreenPadding(top = 16, bottom = 24): { paddingTop: number; paddingBottom: number } {
  const insets = useSafeAreaInsets();
  return { paddingTop: top, paddingBottom: bottom + insets.bottom };
}
