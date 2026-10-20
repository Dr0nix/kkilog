import {
  MEAL_PHOTOS_MAX,
  MEAL_TEXT_MAX_LENGTH,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  type Meal,
  type MealType,
} from '@kkilog/contracts';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createMeal } from '../../src/api/client';
import { errorMessage } from '../../src/api/errors';
import { EatenAtPicker } from '../../src/components/EatenAtPicker';
import { KeyboardScroll } from '../../src/components/KeyboardScroll';
import { MealResultSection } from '../../src/components/MealResultSection';
import { TextField } from '../../src/components/TextField';
import { defaultMealType } from '../../src/meal-type';
import { type PickedPhoto, openAppSettings, pickPhotos } from '../../src/photo';
import { newRequestId } from '../../src/request-id';

type Busy = null | 'photo' | 'analyze';

export default function RecordScreen() {
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType(new Date()));
  // 끼니 태그를 직접 골랐는지. 안 골랐으면 먹은 시각을 바꿀 때 태그도 그 시각에 맞춰 다시 고른다.
  const [mealTypeTouched, setMealTypeTouched] = useState(false);
  // 먹은 시각. null이면 기록하는 순간(지금)
  const [eatenAt, setEatenAt] = useState<Date | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [text, setText] = useState('');
  // 같은 기록을 다시 보낼 때는 같은 id를 써서 중복 기록을 막는다(spec 3). 새 기록을 시작할 때만 바꾼다.
  const [requestId, setRequestId] = useState(newRequestId);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [firstError, setFirstError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [resultBusy, setResultBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  // 내용이 바뀌면 다른 기록이므로 id도 바꾼다. 같은 내용을 다시 보낼 때만 같은 id가 유지된다.
  useEffect(() => {
    setRequestId(newRequestId());
  }, [mealType, photos, text, eatenAt]);

  function changeEatenAt(next: Date | null) {
    setEatenAt(next);
    if (!mealTypeTouched) setMealType(defaultMealType(next ?? new Date()));
  }

  async function choosePhoto(source: 'camera' | 'library') {
    setError(null);
    setPermissionBlocked(false);
    setBusy('photo');
    try {
      const result = await pickPhotos(source, MEAL_PHOTOS_MAX - photos.length);
      if (result.status === 'picked') setPhotos((prev) => [...prev, ...result.photos].slice(0, MEAL_PHOTOS_MAX));
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
      const res = await createMeal({ mealType, clientRequestId: requestId, text: text.trim() || null, photoUris: photos.map((p) => p.uri), eatenAt });
      setFirstError(res.attempt?.status === 'failed' ? '분석하지 못했어요. 기록은 저장돼 있으니 다시 시도해 주세요.' : null);
      setMeal(res.meal);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function startOver() {
    setMeal(null);
    setFirstError(null);
    setPhotos([]);
    setText('');
    setError(null);
    setMealType(defaultMealType(new Date()));
    setMealTypeTouched(false);
    setEatenAt(null);
  }

  const canSubmit = (photos.length > 0 || text.trim() !== '') && busy === null;
  const canAddPhoto = photos.length < MEAL_PHOTOS_MAX && busy === null;

  return (
    <KeyboardScroll contentContainerStyle={styles.container} paddingTop={16} paddingBottom={24}>
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
                onPress={() => {
                  setMealType(type);
                  setMealTypeTouched(true);
                }}
                disabled={busy !== null}
              >
                <Text style={[styles.chipText, mealType === type && styles.chipTextSelected]}>{MEAL_TYPE_LABELS[type]}</Text>
              </Pressable>
            ))}
          </View>

          <EatenAtPicker value={eatenAt} onChange={changeEatenAt} disabled={busy !== null} />

          {photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {photos.map((photo, index) => (
                <View key={photo.uri} style={styles.thumbWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.thumb} resizeMode="cover" />
                  {index === 0 ? <Text style={styles.coverBadge}>대표</Text> : null}
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => setPhotos((prev) => prev.filter((p) => p.uri !== photo.uri))}
                    disabled={busy !== null}
                    hitSlop={8}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.row}>
            <Pressable
              style={[styles.secondary, styles.flex, !canAddPhoto && styles.disabled]}
              onPress={() => void choosePhoto('camera')}
              disabled={!canAddPhoto}
            >
              <Text style={styles.secondaryText}>카메라</Text>
            </Pressable>
            <Pressable
              style={[styles.secondary, styles.flex, !canAddPhoto && styles.disabled]}
              onPress={() => void choosePhoto('library')}
              disabled={!canAddPhoto}
            >
              <Text style={styles.secondaryText}>앨범</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            사진 {photos.length}/{MEAL_PHOTOS_MAX}장 · 한 끼를 여러 장으로 찍었으면 같이 올려 주세요(같은 음식은 한 번만 셉니다)
          </Text>

          {permissionBlocked ? (
            <Pressable onPress={openAppSettings}>
              <Text style={styles.link}>권한이 꺼져 있어요. 설정에서 켜 주세요 ›</Text>
            </Pressable>
          ) : null}

          <TextField
            style={[styles.input, styles.multiline]}
            value={text}
            onChangeText={setText}
            keyboardScroll="end"
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
          <MealResultSection key={meal.id} meal={meal} onMealChange={setMeal} initialError={firstError} onBusyChange={setResultBusy} />

          <View style={styles.row}>
            <Pressable style={[styles.secondary, styles.flex]} onPress={startOver} disabled={resultBusy}>
              <Text style={styles.secondaryText}>새로 기록</Text>
            </Pressable>
            <Pressable style={[styles.primary, styles.flex]} onPress={() => router.back()} disabled={resultBusy}>
              <Text style={styles.primaryText}>완료</Text>
            </Pressable>
          </View>
        </>
      )}
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  header: { gap: 8 },
  back: { fontSize: 16, color: '#555' },
  title: { fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  flex: { flex: 1 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#222', borderColor: '#222' },
  chipText: { fontSize: 15 },
  chipTextSelected: { color: '#fff' },
  thumbs: { gap: 8 },
  thumbWrap: { width: 120, height: 120 },
  thumb: { width: 120, height: 120, borderRadius: 8, backgroundColor: '#eee' },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    fontSize: 11,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 13 },
  hint: { fontSize: 12, color: '#777' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  primary: { backgroundColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16 },
  secondary: { borderWidth: 1, borderColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryText: { color: '#222', fontSize: 16 },
  disabled: { opacity: 0.4 },
  link: { color: '#1565c0', fontSize: 14 },
  error: { color: '#c62828', fontSize: 14 },
});
