import { MEAL_TYPE_LABELS, type Meal } from '@kkilog/contracts';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, deleteMeal, getMeal } from '../../../src/api/client';
import { errorMessage } from '../../../src/api/errors';

const NOT_FOUND_TEXT = '지워졌거나 없는 기록이에요.';
import { MealResultSection } from '../../../src/components/MealResultSection';
import { formatTime } from '../../../src/format';
import { useScreenPadding } from '../../../src/safe-area';

// 홈 끼니 목록에서 들어오는 상세(spec 2.3). 결과·조언·다시 분석·삭제.
export default function MealDetailScreen() {
  const screenPadding = useScreenPadding(16, 24);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMeal((await getMeal(id)).meal);
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'NOT_FOUND' ? NOT_FOUND_TEXT : errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    setBusy(true);
    try {
      await deleteMeal(id);
      router.back();
    } catch (e) {
      // 이미 지워졌으면 목적은 이룬 것이다.
      if (e instanceof ApiError && e.code === 'NOT_FOUND') router.back();
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, screenPadding]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        {meal ? (
          <Text style={styles.title}>
            {MEAL_TYPE_LABELS[meal.meal_type]} <Text style={styles.time}>{formatTime(meal.eaten_at)}</Text>
          </Text>
        ) : null}
      </View>

      {!meal && !error ? <ActivityIndicator style={styles.loading} /> : null}

      {meal ? (
        <>
          {meal.input_text ? <Text style={styles.input}>“{meal.input_text}”</Text> : null}
          <MealResultSection meal={meal} onMealChange={setMeal} onBusyChange={setBusy} />

          {confirmDelete ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>이 기록을 지울까요? 합계에서도 빠져요.</Text>
              <View style={styles.row}>
                <Pressable style={[styles.secondary, styles.flex]} onPress={() => setConfirmDelete(false)} disabled={busy}>
                  <Text style={styles.secondaryText}>취소</Text>
                </Pressable>
                <Pressable style={[styles.danger, styles.flex]} onPress={() => void remove()} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerText}>지우기</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} disabled={busy} hitSlop={8}>
              <Text style={styles.deleteLink}>기록 지우기</Text>
            </Pressable>
          )}
        </>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          {!meal && error !== NOT_FOUND_TEXT ? (
            <Pressable onPress={() => void load()}>
              <Text style={styles.link}>다시 불러오기</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  header: { gap: 8 },
  back: { fontSize: 16, color: '#555' },
  title: { fontSize: 22, fontWeight: '600' },
  time: { fontSize: 16, fontWeight: '400', color: '#777' },
  loading: { marginTop: 40 },
  input: { fontSize: 14, color: '#555' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  confirm: { gap: 10, padding: 16, borderRadius: 12, backgroundColor: '#f6f6f6' },
  confirmText: { fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryText: { color: '#222', fontSize: 16 },
  danger: { backgroundColor: '#c62828', padding: 14, borderRadius: 8, alignItems: 'center' },
  dangerText: { color: '#fff', fontSize: 16 },
  deleteLink: { color: '#c62828', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  errorBox: { gap: 8 },
  error: { color: '#c62828', fontSize: 14 },
  link: { color: '#1565c0', fontSize: 14 },
});
