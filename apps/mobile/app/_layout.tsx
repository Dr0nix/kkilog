import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setUnauthorizedHandler } from '../src/api/client';

export default function RootLayout() {
  useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/access-code'));
    return () => setUnauthorizedHandler(undefined);
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {/* 앱은 밝은 화면만 쓰므로 기기 다크 모드와 상관없이 상태 바 아이콘을 어두운 색으로 고정한다 */}
      <StatusBar style="dark" />
    </>
  );
}
