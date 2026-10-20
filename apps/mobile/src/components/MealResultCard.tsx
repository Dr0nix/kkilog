import type { Meal } from '@kkilog/contracts';
import { Image, StyleSheet, Text, View } from 'react-native';

const CONFIDENCE_LABELS = { high: '', medium: '추정', low: '불확실' } as const;

function grams(value: number): string {
  return `${Math.round(value * 10) / 10}g`;
}

// 음식별 추정치 + 합계 + 추정 근거 메모(spec 2.4). ok 분석이 있을 때만 그린다.
export function MealResultCard({ meal }: { meal: Meal }) {
  const analysis = meal.analysis;
  if (analysis?.status !== 'ok') return null;

  return (
    <View style={styles.card}>
      {meal.photo_url ? <Image source={{ uri: meal.photo_url }} style={styles.photo} resizeMode="cover" /> : null}

      <View style={styles.totals}>
        <Text style={styles.kcal}>{analysis.totals.kcal.toLocaleString()} kcal</Text>
        <Text style={styles.macros}>
          탄 {grams(analysis.totals.carb_g)} · 단 {grams(analysis.totals.protein_g)} · 지 {grams(analysis.totals.fat_g)}
        </Text>
      </View>

      {analysis.items.length === 0 ? (
        <Text style={styles.empty}>음식을 찾지 못했어요.</Text>
      ) : (
        analysis.items.map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.item}>
            <View style={styles.itemHead}>
              <Text style={styles.itemName}>
                {item.name}
                {CONFIDENCE_LABELS[item.confidence] ? (
                  <Text style={styles.confidence}> {CONFIDENCE_LABELS[item.confidence]}</Text>
                ) : null}
              </Text>
              <Text style={styles.itemKcal}>{Math.round(item.kcal)} kcal</Text>
            </View>
            <Text style={styles.itemSub}>
              {item.quantity}
              {item.unit} · 약 {Math.round(item.estimated_grams)}g · 탄 {grams(item.carb_g)} 단 {grams(item.protein_g)} 지{' '}
              {grams(item.fat_g)}
            </Text>
          </View>
        ))
      )}

      {analysis.correction_text ? <Text style={styles.note}>보정: {analysis.correction_text}</Text> : null}
      {analysis.notes ? <Text style={styles.note}>{analysis.notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 12, padding: 16, gap: 10, backgroundColor: '#fff' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#eee' },
  totals: { gap: 2 },
  kcal: { fontSize: 28, fontWeight: '700' },
  macros: { fontSize: 14, color: '#555' },
  empty: { fontSize: 15, color: '#555' },
  item: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 8, gap: 2 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 16, fontWeight: '500', flexShrink: 1 },
  confidence: { fontSize: 12, color: '#999', fontWeight: '400' },
  itemKcal: { fontSize: 16 },
  itemSub: { fontSize: 13, color: '#777' },
  note: { fontSize: 13, color: '#666' },
});
