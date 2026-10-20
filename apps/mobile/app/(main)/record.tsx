import {
  CORRECTION_TEXT_MAX_LENGTH,
  MEAL_TEXT_MAX_LENGTH,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  type Meal,
  type MealType,
} from '@kkilog/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, UnauthorizedError, analyzeMeal, createMeal } from '../../src/api/client';
import { MealResultCard } from '../../src/components/MealResultCard';
import { defaultMealType } from '../../src/meal-type';
import { type PickedPhoto, openAppSettings, pickPhoto } from '../../src/photo';
import { newRequestId } from '../../src/request-id';

type Busy = null | 'photo' | 'analyze' | 'reanalyze';

const NETWORK_ERROR = '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';

export default function RecordScreen() {
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType(new Date()));
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [text, setText] = useState('');
  // 같은 기록을 다시 보낼 때는 같은 id를 써서 중복 기록을 막는다(spec 3). 새 기록을 시작할 때만 바꾼다.
  const [requestId, setRequestId] = useState(newRequestId);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [correction, setCorrection] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  // 내용이 바뀌면 다른 기록이므로 id도 바꾼다. 같은 내용을 다시 보낼 때만 같은 id가 유지된다.
  useEffect(() => {
    setRequestId(newRequestId());
  }, [mealType, photo, text]);

  function handleError(e: unknown, fallback = NETWORK_ERROR) {
    if (e instanceof UnauthorizedError) return; // client가 코드 입력 화면으로 보낸다
    if (e instanceof ApiError && e.code === 'ONBOARDING_REQUIRED') {
      router.replace('/onboarding');
      return;
    }
    setError(fallback);
  }

  async function choosePhoto(source: 'camera' | 'library') {
    setError(null);
    setPermissionBlocked(false);
    setBusy('photo');
    try {
      const result = await pickPhoto(source);
      if (result.status === 'picked') setPhoto(result.photo);
      else if (result.status === 'blocked') setPermissionBlocked(true);
      else if (result.status === 'denied') setError(source === 'camera' ? '카메라 권한이 필요해요.' : '사진 권한이 필요해요.');
    } catch {
      setError('사진을 불러오지 못했어요. 다른 사진으로 해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setError(null);
    setBusy('analyze');
    try {
      const res = await createMeal({ mealType, clientRequestId: requestId, text: text.trim() || null, photoUri: photo?.uri ?? null });
      setMeal(res.meal);
      if (res.attempt?.status === 'failed') setError('분석하지 못했어요. 기록은 저장돼 있으니 다시 시도해 주세요.');
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(null);
    }
  }

  // correction이 없으면 재시도(서버가 마지막 보정을 그대로 쓴다).
  async function reanalyze(correctionText?: string) {
    if (!meal) return;
    setError(null);
    setBusy('reanalyze');
    try {
      const res = await analyzeMeal(meal.id, correctionText ? { correction_text: correctionText } : {});
      setMeal(res.meal);
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
      handleError(e);
    } finally {
      setBusy(null);
    }
  }

  function startOver() {
    setMeal(null);
    setPhoto(null);
    setText('');
    setCorrection('');
    setError(null);
    setMealType(defaultMealType(new Date()));
  }

  const canSubmit = (photo !== null || text.trim() !== '') && busy === null;
  const analyzed = meal?.analysis?.status === 'ok';

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>{MEAL_TYPE_LABELS[mealType]} 기록</Text>
      </View>

      {!meal ? (
        <>
          <View style={styles.row}>
            {MEAL_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.chip, mealType === type && styles.chipSelected]}
                onPress={() => setMealType(type)}
                disabled={busy !== null}
              >
                <Text style={[styles.chipText, mealType === type && styles.chipTextSelected]}>{MEAL_TYPE_LABELS[type]}</Text>
              </Pressable>
            ))}
          </View>

          {photo ? (
            <View style={styles.preview}>
              <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
              <Pressable onPress={() => setPhoto(null)} disabled={busy !== null}>
                <Text style={styles.link}>사진 빼기</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.row}>
            <Pressable style={[styles.secondary, styles.flex]} onPress={() => void choosePhoto('camera')} disabled={busy !== null}>
              <Text style={styles.secondaryText}>카메라</Text>
            </Pressable>
            <Pressable style={[styles.secondary, styles.flex]} onPress={() => void choosePhoto('library')} disabled={busy !== null}>
              <Text style={styles.secondaryText}>앨범</Text>
            </Pressable>
          </View>

          {permissionBlocked ? (
            <Pressable onPress={openAppSettings}>
              <Text style={styles.link}>권한이 꺼져 있어요. 설정에서 켜 주세요 ›</Text>
            </Pressable>
          ) : null}

          <TextInput
            style={[styles.input, styles.multiline]}
            value={text}
            onChangeText={setText}
            placeholder="먹은 것을 적어도 돼요 (예: 삶은 계란 3개, 프로틴음료 1개)"
            multiline
            maxLength={MEAL_TEXT_MAX_LENGTH}
            editable={busy === null}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primary, !canSubmit && styles.disabled]} disabled={!canSubmit} onPress={() => void submit()}>
            {busy === 'analyze' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>분석</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <MealResultCard meal={meal} />

          {!analyzed ? (
            <View style={styles.failed}>
              <Text style={styles.failedText}>분석 실패 · 기록은 저장돼 있어요</Text>
              <Pressable style={styles.primary} disabled={busy !== null} onPress={() => void reanalyze()}>
                {busy === 'reanalyze' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>재시도</Text>}
              </Pressable>
            </View>
          ) : (
            <View style={styles.correction}>
              <Text style={styles.label}>결과가 틀렸나요? 한 줄로 알려 주세요</Text>
              <TextInput
                style={styles.input}
                value={correction}
                onChangeText={setCorrection}
                placeholder="예: 밥 반 공기만 먹음"
                maxLength={CORRECTION_TEXT_MAX_LENGTH}
                editable={busy === null}
              />
              <Pressable
                style={[styles.secondary, (busy !== null || !correction.trim()) && styles.disabled]}
                disabled={busy !== null || !correction.trim()}
                onPress={() => void reanalyze(correction.trim())}
              >
                {busy === 'reanalyze' ? <ActivityIndicator /> : <Text style={styles.secondaryText}>다시 분석</Text>}
              </Pressable>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.row}>
            <Pressable style={[styles.secondary, styles.flex]} onPress={startOver} disabled={busy !== null}>
              <Text style={styles.secondaryText}>새로 기록</Text>
            </Pressable>
            <Pressable style={[styles.primary, styles.flex]} onPress={() => router.back()} disabled={busy !== null}>
              <Text style={styles.primaryText}>완료</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 48, gap: 14 },
  header: { gap: 8 },
  back: { fontSize: 16, color: '#555' },
  title: { fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  flex: { flex: 1 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#222', borderColor: '#222' },
  chipText: { fontSize: 15 },
  chipTextSelected: { color: '#fff' },
  preview: { gap: 6, alignItems: 'flex-end' },
  previewImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#eee' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  label: { fontSize: 14, color: '#555' },
  primary: { backgroundColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16 },
  secondary: { borderWidth: 1, borderColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryText: { color: '#222', fontSize: 16 },
  disabled: { opacity: 0.4 },
  link: { color: '#1565c0', fontSize: 14 },
  error: { color: '#c62828', fontSize: 14 },
  failed: { gap: 10, padding: 16, borderRadius: 12, backgroundColor: '#fdecea' },
  failedText: { fontSize: 15, color: '#8a1c1c' },
  correction: { gap: 8 },
});
