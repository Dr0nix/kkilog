import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { UnauthorizedError, getMe } from '../src/api/client';
import { getStoredCode } from '../src/api/code-store';

// 시작 화면: 저장된 코드가 있으면 확인해서 온보딩/홈으로, 없으면 코드 입력으로 보낸다.
export default function Index() {
  const [failed, setFailed] = useState(false);

  const start = useCallback(async () => {
    setFailed(false);
    if (!(await getStoredCode())) {
      router.replace('/access-code');
      return;
    }
    try {
      const me = await getMe();
      router.replace(me.has_profile ? '/home' : '/onboarding');
    } catch (error) {
      // 401은 client가 코드 입력 화면으로 보낸다.
      if (!(error instanceof UnauthorizedError)) setFailed(true);
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  return (
    <View style={styles.container}>
      {failed ? (
        <>
          <Text style={styles.message}>서버에 연결하지 못했습니다.</Text>
          <Pressable style={styles.button} onPress={() => void start()}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  message: { fontSize: 16 },
  button: { backgroundColor: '#222', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16 },
});
