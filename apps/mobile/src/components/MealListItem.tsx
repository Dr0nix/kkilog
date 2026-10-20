import { MEAL_TYPE_LABELS, type Meal } from '@kkilog/contracts';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTime } from '../format';

function summary(meal: Meal): string {
  if (meal.analysis?.status === 'ok') {
    const names = meal.analysis.items.map((item) => item.name);
    if (names.length === 0) return '음식을 찾지 못했어요';
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}개` : names.join(', ');
  }
  return meal.input_text ?? '사진 기록';
}

// 홈 끼니 목록 한 줄(spec 2.3). 분석 실패한 끼니도 보이되 합계에선 빠진다.
export function MealListItem({ meal, onPress }: { meal: Meal; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {meal.photo_url ? (
        <View>
          <Image source={{ uri: meal.photo_url }} style={styles.thumb} />
          {meal.photo_urls.length > 1 ? <Text style={styles.more}>+{meal.photo_urls.length - 1}</Text> : null}
        </View>
      ) : (
        <View style={[styles.thumb, styles.noPhoto]}>
          <Text style={styles.noPhotoText}>글</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.type}>
          {MEAL_TYPE_LABELS[meal.meal_type]} <Text style={styles.time}>{formatTime(meal.eaten_at)}</Text>
        </Text>
        <Text style={styles.names} numberOfLines={1}>
          {summary(meal)}
        </Text>
      </View>
      {meal.analysis?.status === 'ok' ? (
        <Text style={styles.kcal}>{meal.analysis.totals.kcal.toLocaleString()} kcal</Text>
      ) : (
        <Text style={styles.failed}>{meal.analysis ? '분석 실패 · 재시도' : '분석 전'}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#eee' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  more: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  noPhotoText: { color: '#999', fontSize: 14 },
  body: { flex: 1, gap: 2 },
  type: { fontSize: 15, fontWeight: '600' },
  time: { fontSize: 13, fontWeight: '400', color: '#888' },
  names: { fontSize: 14, color: '#555' },
  kcal: { fontSize: 15, fontWeight: '500' },
  failed: { fontSize: 13, color: '#c62828' },
});
