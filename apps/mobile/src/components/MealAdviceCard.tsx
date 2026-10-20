import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export type AdviceView = { status: 'loading' } | { status: 'ok'; text: string } | { status: 'failed' };

// 결과 카드 아래 영양 조언(spec 2.4). 실패해도 기록은 저장돼 있으니 [조언 다시 받기]만 보인다.
export function MealAdviceCard({ advice, onRetry }: { advice: AdviceView; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>영양 조언</Text>
      {advice.status === 'loading' ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.muted}>조언을 만드는 중…</Text>
        </View>
      ) : advice.status === 'ok' ? (
        <Text style={styles.text}>{advice.text}</Text>
      ) : (
        <View style={styles.row}>
          <Text style={[styles.muted, styles.flex]}>조언을 불러오지 못했어요.</Text>
          <Pressable onPress={onRetry} hitSlop={8}>
            <Text style={styles.link}>조언 다시 받기</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, gap: 8, backgroundColor: '#eef6ee' },
  title: { fontSize: 14, fontWeight: '600', color: '#2e5d32' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  text: { fontSize: 15, lineHeight: 22, color: '#1f3b21' },
  muted: { fontSize: 14, color: '#555' },
  link: { color: '#1565c0', fontSize: 14 },
});
