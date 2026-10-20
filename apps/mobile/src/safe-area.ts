import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 앱이 edge-to-edge로 그려져서 상태 바·내비게이션 바 밑까지 화면이 깔린다.
// 화면 위·아래 여백에 시스템 바 높이(inset)를 더해 겹치지 않게 한다.
export function useScreenPadding(top = 16, bottom = 24): { paddingTop: number; paddingBottom: number } {
  const insets = useSafeAreaInsets();
  return { paddingTop: top + insets.top, paddingBottom: bottom + insets.bottom };
}
