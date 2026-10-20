import type { DailyTarget, MealTotals } from '@kkilog/contracts';
import { StyleSheet, Text, View } from 'react-native';

const MACROS = [
  { key: 'carb_g', label: '탄수화물', color: '#f2a93b' },
  { key: 'protein_g', label: '단백질', color: '#4c8bf5' },
  { key: 'fat_g', label: '지방', color: '#e0605e' },
] as const;

function Bar({ ratio, color }: { ratio: number; color: string }) {
  // 목표를 넘으면 가득 채우고 색을 진하게 둔다.
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%` as const;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width, backgroundColor: color, opacity: ratio > 1 ? 1 : 0.85 }]} />
    </View>
  );
}

// 하루 섭취 / 목표(spec 2.3). 목표가 없는 날(온보딩 전)은 먹은 양만 보여준다.
export function DailySummaryCard({ totals, target }: { totals: MealTotals; target: DailyTarget | null }) {
  const remaining = target ? target.kcal - totals.kcal : null;
  return (
    <View style={styles.card}>
      <View style={styles.kcalRow}>
        <Text style={styles.kcal}>{totals.kcal.toLocaleString()}</Text>
        <Text style={styles.kcalTarget}>{target ? ` / ${target.kcal.toLocaleString()} kcal` : ' kcal'}</Text>
      </View>
      {target ? <Bar ratio={totals.kcal / target.kcal} color="#222" /> : null}
      {remaining !== null ? (
        <Text style={[styles.remaining, remaining < 0 && styles.over]}>
          {remaining >= 0 ? `${remaining.toLocaleString()} kcal 남음` : `${(-remaining).toLocaleString()} kcal 넘음`}
        </Text>
      ) : null}

      <View style={styles.macros}>
        {MACROS.map(({ key, label, color }) => {
          const goal = target?.[key] ?? null;
          return (
            <View key={key} style={styles.macro}>
              <Text style={styles.macroLabel}>{label}</Text>
              <Text style={styles.macroValue}>
                {Math.round(totals[key])}
                <Text style={styles.macroGoal}>{goal !== null ? ` / ${Math.round(goal)}g` : 'g'}</Text>
              </Text>
              {goal ? <Bar ratio={totals[key] / goal} color={color} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 18, gap: 10, backgroundColor: '#f6f6f6' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline' },
  kcal: { fontSize: 36, fontWeight: '700' },
  kcalTarget: { fontSize: 16, color: '#666' },
  remaining: { fontSize: 14, color: '#555' },
  over: { color: '#c62828' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#e2e2e2', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  macros: { flexDirection: 'row', gap: 12, marginTop: 6 },
  macro: { flex: 1, gap: 4 },
  macroLabel: { fontSize: 12, color: '#666' },
  macroValue: { fontSize: 16, fontWeight: '600' },
  macroGoal: { fontSize: 12, fontWeight: '400', color: '#888' },
});
