import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setUnauthorizedHandler } from '../src/api/client';

export default function RootLayout() {
  useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/access-code'));
    return () => setUnauthorizedHandler(undefined);
  }, []);

  return (
    // 앱이 edge-to-edge로 그려져 상태 바가 투명하다. 모든 화면 위에 상태 바 높이만큼 스크롤되지 않는 흰 띠를 둬서
    // 스크롤한 내용이 시계·아이콘 밑으로 올라가 겹치지 않게 한다. 하단 inset은 화면마다 처리한다(safe-area.ts).
    <SafeAreaView edges={['top']} style={styles.root}>
      <Stack screenOptions={{ headerShown: false, contentStyle: styles.screen }} />
      {/* 앱은 밝은 화면만 쓰므로 기기 다크 모드와 상관없이 상태 바 아이콘을 어두운 색으로 고정한다 */}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  screen: { backgroundColor: '#fff' },
});
