import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// 대시보드는 PR 10에서 구현한다. 지금은 기록 화면으로 가는 버튼만 둔다.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>홈 (준비 중)</Text>
      <Pressable style={styles.button} onPress={() => router.push('/record')}>
        <Text style={styles.buttonText}>기록하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  text: { fontSize: 16, color: '#555' },
  button: { backgroundColor: '#222', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 18 },
});
