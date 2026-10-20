import type { HomeResponse } from '@kkilog/contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getHome } from '../../src/api/client';
import { NETWORK_ERROR, shouldShowError } from '../../src/api/errors';
import { DailySummaryCard } from '../../src/components/DailySummaryCard';
import { MealListItem } from '../../src/components/MealListItem';
import { WeightRow } from '../../src/components/WeightRow';
import { formatLocalDate, shiftLocalDate } from '../../src/format';

// 대시보드(spec 2.3). date가 null이면 오늘(서버 타임존 기준).
export default function HomeScreen() {
  const [date, setDate] = useState<string | null>(null);
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // 날짜를 빨리 넘기면 늦게 온 이전 날짜 응답은 버린다.
  const latestRequest = useRef(0);

  const load = useCallback(async (target: string | null) => {
    const request = ++latestRequest.current;
    setError(null);
    try {
      const res = await getHome(target ?? undefined);
      if (request === latestRequest.current) setHome(res);
    } catch (e) {
      if (request === latestRequest.current && shouldShowError(e)) setError(NETWORK_ERROR);
    }
  }, []);

  // 기록·상세 화면에서 돌아오면 다시 불러온다.
  useFocusEffect(
    useCallback(() => {
      void load(date);
    }, [date, load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load(date);
    setRefreshing(false);
  }

  function move(days: number) {
    if (!home) return;
    const next = shiftLocalDate(home.date, days);
    setHome(null);
    setDate(next >= home.today ? null : next);
  }

  const isToday = home ? home.date === home.today : true;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push('/trend')} hitSlop={8}>
            <Text style={styles.link}>추세</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
            <Text style={styles.link}>프로필</Text>
          </Pressable>
        </View>

        <View style={styles.dateRow}>
          <Pressable onPress={() => move(-1)} hitSlop={12} disabled={!home}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Text style={styles.date}>
            {home ? (isToday ? `오늘 · ${formatLocalDate(home.date)}` : formatLocalDate(home.date)) : ' '}
          </Text>
          <Pressable onPress={() => move(1)} hitSlop={12} disabled={!home || isToday}>
            <Text style={[styles.arrow, isToday && styles.arrowDisabled]}>›</Text>
          </Pressable>
        </View>

        {!home && !error ? <ActivityIndicator style={styles.loading} /> : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load(date)}>
              <Text style={styles.link}>다시 불러오기</Text>
            </Pressable>
          </View>
        ) : null}

        {home ? (
          <>
            <DailySummaryCard totals={home.totals} target={home.target} />
            <WeightRow weight={home.weight} isToday={isToday} onSaved={() => void load(date)} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>끼니</Text>
              {home.meals.length === 0 ? (
                <Text style={styles.empty}>{isToday ? '아직 기록한 끼니가 없어요.' : '기록한 끼니가 없어요.'}</Text>
              ) : (
                home.meals.map((meal) => (
                  <MealListItem key={meal.id} meal={meal} onPress={() => router.push(`/meal/${meal.id}`)} />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.bottom}>
        <Pressable style={styles.recordButton} onPress={() => router.push('/record')}>
          <Text style={styles.recordText}>기록하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 48, paddingBottom: 120, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  link: { color: '#1565c0', fontSize: 15 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { fontSize: 28, color: '#222', paddingHorizontal: 8 },
  arrowDisabled: { color: '#ccc' },
  date: { fontSize: 18, fontWeight: '600' },
  loading: { marginTop: 40 },
  errorBox: { gap: 8 },
  error: { color: '#c62828', fontSize: 14 },
  section: { gap: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#444', marginBottom: 4 },
  empty: { fontSize: 14, color: '#888', paddingVertical: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: '#fff' },
  recordButton: { backgroundColor: '#222', paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  recordText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
