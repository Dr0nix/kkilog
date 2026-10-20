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
      <StatusBar style="auto" />
    </>
  );
}
