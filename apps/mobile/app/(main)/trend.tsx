import type { TrendResponse } from '@kkilog/contracts';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getTrend } from '../../src/api/client';
import { NETWORK_ERROR, shouldShowError } from '../../src/api/errors';
import { WeightChart } from '../../src/components/WeightChart';
import { formatKg, formatLocalDate } from '../../src/format';
import { useScreenPadding } from '../../src/safe-area';

const RANGES = [
  { days: 30, label: '1개월' },
  { days: 90, label: '3개월' },
  { days: 180, label: '6개월' },
] as const;

function goalText(trend: TrendResponse): string {
  const goal = trend.goal;
  if (!goal) return '-';
  switch (goal.status) {
    case 'reached':
      return '목표에 도달했어요';
    case 'on_track':
      return goal.eta_date ? `${formatLocalDate(goal.eta_date)} 예상` : '-';
    case 'not_progressing':
      return '이 속도로는 예상하기 어려워요';
    case 'insufficient_data':
      return '기록이 일주일 넘게 쌓이면 알려 드려요';
  }
}

function remainingText(kg: number): string {
  if (kg > 0) return `${formatKg(kg)} 감량`;
  if (kg < 0) return `${formatKg(-kg)} 증량`;
  return '0kg';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// 체중 그래프 + 남은 kg·기울기·도달 예상 + 최근 7일 평균 섭취(spec 2.5)
export default function TrendScreen() {
  const screenPadding = useScreenPadding(16, 24);
  const [days, setDays] = useState<number>(RANGES[0].days);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async (range: number) => {
    const request = ++latestRequest.current;
    setError(null);
    try {
      const res = await getTrend(range);
      if (request === latestRequest.current) setTrend(res);
    } catch (e) {
      if (request === latestRequest.current && shouldShowError(e)) setError(NETWORK_ERROR);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const slope = trend?.slope_kg_per_week ?? null;
  const intake = trend?.intake;

  return (
    <ScrollView contentContainerStyle={[styles.container, screenPadding]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>추세</Text>
      </View>

      <View style={styles.ranges}>
        {RANGES.map((range) => (
          <Pressable
            key={range.days}
            style={[styles.chip, days === range.days && styles.chipSelected]}
            onPress={() => setDays(range.days)}
          >
            <Text style={[styles.chipText, days === range.days && styles.chipTextSelected]}>{range.label}</Text>
          </Pressable>
        ))}
      </View>

      {!trend && !error ? <ActivityIndicator style={styles.loading} /> : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load(days)}>
            <Text style={styles.link}>다시 불러오기</Text>
          </Pressable>
        </View>
      ) : null}

      {trend ? (
        <>
          <WeightChart points={trend.points} targetKg={trend.target_weight_kg} />
          <View style={styles.legend}>
            <Text style={styles.legendItem}>
              <Text style={styles.dot}>●</Text> 실측
            </Text>
            <Text style={styles.legendItem}>━ 추세</Text>
            <Text style={[styles.legendItem, styles.targetLegend]}>┄ 목표 {formatKg(trend.target_weight_kg)}</Text>
          </View>

          <View style={styles.stats}>
            <Stat label="현재 추세" value={trend.trend_kg === null ? '-' : formatKg(trend.trend_kg)} />
            <Stat label="목표까지" value={trend.goal ? remainingText(trend.goal.remaining_kg) : '-'} />
            <Stat
              label="최근 14일 속도"
              value={slope === null ? '-' : `${slope > 0 ? '+' : ''}${slope.toFixed(2)}kg/주`}
            />
            <Stat label="도달 예상" value={goalText(trend)} />
          </View>

          {intake ? (
            <View style={styles.intake}>
              <Text style={styles.intakeTitle}>최근 {intake.days}일 평균 섭취</Text>
              {intake.average ? (
                <>
                  <Text style={styles.intakeValue}>
                    {intake.average.kcal.toLocaleString()}
                    <Text style={styles.intakeTarget}>
                      {intake.target_kcal !== null ? ` / 목표 ${intake.target_kcal.toLocaleString()} kcal` : ' kcal'}
                    </Text>
                  </Text>
                  <Text style={styles.intakeSub}>
                    탄 {Math.round(intake.average.carb_g)}g · 단 {Math.round(intake.average.protein_g)}g · 지{' '}
                    {Math.round(intake.average.fat_g)}g · 기록한 날 {intake.logged_days}일 기준
                  </Text>
                </>
              ) : (
                <Text style={styles.intakeSub}>지난 {intake.days}일 동안 기록한 끼니가 없어요.</Text>
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  header: { gap: 8 },
  back: { fontSize: 16, color: '#555' },
  title: { fontSize: 22, fontWeight: '600' },
  ranges: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#222', borderColor: '#222' },
  chipText: { fontSize: 14 },
  chipTextSelected: { color: '#fff' },
  loading: { marginTop: 40 },
  errorBox: { gap: 8 },
  error: { color: '#c62828', fontSize: 14 },
  link: { color: '#1565c0', fontSize: 14 },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { fontSize: 12, color: '#555' },
  dot: { color: '#4c8bf5' },
  targetLegend: { color: '#2e7d32' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '48%', flexGrow: 1, padding: 14, borderRadius: 12, backgroundColor: '#f6f6f6', gap: 4 },
  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 16, fontWeight: '600' },
  intake: { padding: 16, borderRadius: 12, backgroundColor: '#f6f6f6', gap: 6 },
  intakeTitle: { fontSize: 13, color: '#666' },
  intakeValue: { fontSize: 24, fontWeight: '700' },
  intakeTarget: { fontSize: 14, fontWeight: '400', color: '#666' },
  intakeSub: { fontSize: 13, color: '#555' },
});
