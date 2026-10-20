import { CORRECTION_TEXT_MAX_LENGTH, type Meal } from '@kkilog/contracts';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { UnauthorizedError, analyzeMeal, getMealAdvice } from '../api/client';
import { errorMessage } from '../api/errors';
import { type AdviceView, MealAdviceCard } from './MealAdviceCard';
import { MealResultCard } from './MealResultCard';
import { TextField } from './TextField';

// 결과 카드 + 영양 조언 + [다시 분석]/[재시도](spec 2.4). 기록 화면과 끼니 상세 화면이 같이 쓴다.
export function MealResultSection({
  meal,
  onMealChange,
  initialError = null,
  onBusyChange,
}: {
  meal: Meal;
  onMealChange: (meal: Meal) => void;
  initialError?: string | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [correction, setCorrection] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [advice, setAdvice] = useState<AdviceView | null>(null);

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  // 조언은 현재 ok 분석에 붙는다. 재분석으로 분석이 바뀌면 새로 받고, 늦게 온 이전 분석의 조언은 버린다.
  const okAnalysisAt = meal.analysis?.status === 'ok' ? meal.analysis.created_at : null;
  const adviceFor = useRef<string | null>(null);

  async function loadAdvice(analysisAt: string) {
    adviceFor.current = analysisAt;
    setAdvice({ status: 'loading' });
    try {
      const res = await getMealAdvice(meal.id);
      if (adviceFor.current !== analysisAt) return;
      setAdvice({ status: 'ok', text: res.advice.text });
    } catch (e) {
      if (adviceFor.current !== analysisAt) return;
      if (e instanceof UnauthorizedError) return;
      setAdvice({ status: 'failed' });
    }
  }

  useEffect(() => {
    if (okAnalysisAt) void loadAdvice(okAnalysisAt);
    // meal 객체가 아니라 분석이 바뀔 때만 다시 받는다.
  }, [okAnalysisAt]);

  // correction이 없으면 재시도(서버가 마지막 보정을 그대로 쓴다).
  async function reanalyze(correctionText?: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await analyzeMeal(meal.id, correctionText ? { correction_text: correctionText } : {});
      onMealChange(res.meal);
      if (res.attempt?.status === 'failed') {
        setError(
          res.meal.analysis?.status === 'ok'
            ? '다시 분석하지 못했어요. 이전 결과를 그대로 보여드려요.'
            : '분석하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
      } else {
        setCorrection('');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const analyzed = okAnalysisAt !== null;

  return (
    <View style={styles.container}>
      <MealResultCard meal={meal} />

      {analyzed && advice ? (
        <MealAdviceCard
          advice={advice}
          onRetry={() => {
            if (okAnalysisAt) void loadAdvice(okAnalysisAt);
          }}
        />
      ) : null}

      {!analyzed ? (
        <View style={styles.failed}>
          <Text style={styles.failedText}>
            {meal.analysis ? '분석 실패 · 기록은 저장돼 있어요' : '아직 분석하지 않았어요'}
          </Text>
          <Pressable style={styles.primary} disabled={busy} onPress={() => void reanalyze()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>재시도</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={styles.correction}>
          <Text style={styles.label}>결과가 틀렸나요? 한 줄로 알려 주세요</Text>
          <TextField
            style={styles.input}
            value={correction}
            onChangeText={setCorrection}
            keyboardScroll="end"
            placeholder="예: 밥 반 공기만 먹음"
            maxLength={CORRECTION_TEXT_MAX_LENGTH}
            editable={!busy}
          />
          <Pressable
            style={[styles.secondary, (busy || !correction.trim()) && styles.disabled]}
            disabled={busy || !correction.trim()}
            onPress={() => void reanalyze(correction.trim())}
          >
            {busy ? <ActivityIndicator /> : <Text style={styles.secondaryText}>다시 분석</Text>}
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  label: { fontSize: 14, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  primary: { backgroundColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16 },
  secondary: { borderWidth: 1, borderColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryText: { color: '#222', fontSize: 16 },
  disabled: { opacity: 0.4 },
  error: { color: '#c62828', fontSize: 14 },
  failed: { gap: 10, padding: 16, borderRadius: 12, backgroundColor: '#fdecea' },
  failedText: { fontSize: 15, color: '#8a1c1c' },
  correction: { gap: 8 },
});
