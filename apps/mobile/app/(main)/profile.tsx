import {
  ACTIVITY_LEVELS,
  CALORIE_TARGET_FIELDS,
  type CalorieTarget,
  type CurrentCalorieTarget,
  type Profile,
  type UpdateProfileRequest,
  UpdateProfileRequestSchema,
} from '@kkilog/contracts';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  type KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError, getProfile, updateProfile } from '../../src/api/client';
import { NETWORK_ERROR, shouldShowError } from '../../src/api/errors';
import { TextField } from '../../src/components/TextField';
import { formatKg } from '../../src/format';
import { type Form, type NumberField, changes, toForm } from '../../src/profile-form';

const NUMBER_FIELDS: { key: NumberField; label: string; keyboard: KeyboardTypeOptions }[] = [
  { key: 'age', label: '나이', keyboard: 'number-pad' },
  { key: 'height_cm', label: '키 (cm)', keyboard: 'decimal-pad' },
  { key: 'target_weight_kg', label: '목표 몸무게 (kg)', keyboard: 'decimal-pad' },
  { key: 'goal_months', label: '목표 기간 (지금부터 몇 개월 안에)', keyboard: 'number-pad' },
];

const FIELD_LABELS: Record<keyof UpdateProfileRequest, string> = {
  nickname: '닉네임(1~20자)',
  sex: '성별',
  age: '나이(14~100)',
  height_cm: '키(100~250cm)',
  target_weight_kg: '목표 몸무게(20~300kg)',
  activity_level: '운동 정도',
  goal_months: '목표 기간(1~24개월, 정수)',
};

function TargetSummary({ target }: { target: CurrentCalorieTarget | CalorieTarget }) {
  return (
    <View style={styles.target}>
      <Text style={styles.targetKcal}>하루 {target.kcal.toLocaleString()} kcal</Text>
      {target.macros ? (
        <Text style={styles.targetMacros}>
          탄 {Math.round(target.macros.carb_g)}g · 단 {Math.round(target.macros.protein_g)}g · 지{' '}
          {Math.round(target.macros.fat_g)}g
        </Text>
      ) : null}
      {target.clamped ? <Text style={styles.notice}>목표 기간 안에 도달하려면 너무 적게 먹어야 해서 최저 기준으로 맞췄어요.</Text> : null}
      {target.reason ? <Text style={styles.help}>{target.reason}</Text> : null}
    </View>
  );
}

// 프로필 수정(spec 2.2). 몸무게는 고치지 않고 체중 기록으로 남긴다.
// 목표 칼로리에 영향을 주는 항목을 바꾸면 최근 체중으로 목표를 다시 정한다.
export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [target, setTarget] = useState<CurrentCalorieTarget | CalorieTarget | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getProfile();
      setProfile(res.profile);
      setTarget(res.calorie_target);
      setForm(toForm(res.profile));
    } catch (e) {
      if (shouldShowError(e)) setError(NETWORK_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const diff = profile && form ? changes(profile, form) : {};
  const recalculates = CALORIE_TARGET_FIELDS.some((field) => field in diff);
  const dirty = Object.keys(diff).length > 0;

  async function save() {
    if (!profile || !form) return;
    setMessage(null);
    const parsed = UpdateProfileRequestSchema.safeParse(diff);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => i.path[0]))].filter(Boolean) as (keyof UpdateProfileRequest)[];
      setError(fields.length ? `다시 확인해 주세요: ${fields.map((f) => FIELD_LABELS[f]).join(', ')}` : '바뀐 항목이 없어요.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await updateProfile(parsed.data);
      setProfile(res.profile);
      setForm(toForm(res.profile));
      if (res.new_calorie_target) {
        setTarget(res.new_calorie_target);
        setMessage('목표 칼로리를 새로 정했어요.');
      } else {
        setMessage('저장했어요.');
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UPSTREAM_UNAVAILABLE') {
        setError('목표 칼로리를 계산하지 못했어요. 바뀐 내용은 저장되지 않았어요. 잠시 후 다시 시도해 주세요.');
      } else if (shouldShowError(e)) {
        setError(NETWORK_ERROR);
      }
    } finally {
      setSaving(false);
    }
  }

  const update = (patch: Partial<Form>) => {
    setMessage(null);
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>프로필</Text>
      </View>

      {!form && !error ? <ActivityIndicator style={styles.loading} /> : null}

      {target ? <TargetSummary target={target} /> : null}

      {profile && form ? (
        <>
          <Text style={styles.label}>닉네임</Text>
          <TextField style={styles.input} value={form.nickname} onChangeText={(nickname) => update({ nickname })} maxLength={20} />

          <Text style={styles.label}>성별</Text>
          <View style={styles.row}>
            {(['male', 'female'] as const).map((value) => (
              <Pressable
                key={value}
                style={[styles.choice, styles.flex, form.sex === value && styles.choiceSelected]}
                onPress={() => update({ sex: value })}
              >
                <Text style={[styles.choiceText, form.sex === value && styles.choiceTextSelected]}>
                  {value === 'male' ? '남' : '여'}
                </Text>
              </Pressable>
            ))}
          </View>

          {NUMBER_FIELDS.map(({ key, label, keyboard }) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextField
                style={styles.input}
                value={form[key]}
                onChangeText={(text) => update({ [key]: text })}
                keyboardType={keyboard}
              />
            </View>
          ))}

          <Text style={styles.label}>현재 몸무게</Text>
          <Text style={styles.readonly}>
            {profile.latest_weight_kg === null ? '-' : formatKg(profile.latest_weight_kg)} · 홈에서 체중 기록으로 바꿔요
          </Text>

          <Text style={styles.label}>운동 정도</Text>
          {ACTIVITY_LEVELS.map((activity) => {
            const selected = form.activity_level === activity.level;
            return (
              <Pressable
                key={activity.level}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => update({ activity_level: activity.level })}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                  {activity.level}. {activity.label}
                </Text>
                <Text style={[styles.choiceSub, selected && styles.choiceTextSelected]}>{activity.description}</Text>
              </Pressable>
            );
          })}

          {recalculates ? (
            <Text style={styles.notice}>
              저장하면 최근 몸무게로 목표 칼로리를 다시 정하고, 목표 기간은 오늘부터 다시 세요.
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            style={[styles.button, (!dirty || saving) && styles.buttonDisabled]}
            disabled={!dirty || saving}
            onPress={() => void save()}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>저장</Text>}
          </Pressable>
        </>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.link}>다시 불러오기</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 48, paddingBottom: 48, gap: 8 },
  header: { gap: 8, marginBottom: 8 },
  back: { fontSize: 16, color: '#555' },
  title: { fontSize: 22, fontWeight: '600' },
  loading: { marginTop: 40 },
  target: { padding: 16, borderRadius: 12, backgroundColor: '#f6f6f6', gap: 6, marginBottom: 8 },
  targetKcal: { fontSize: 20, fontWeight: '700' },
  targetMacros: { fontSize: 14, color: '#555' },
  help: { fontSize: 13, color: '#666' },
  label: { fontSize: 14, color: '#555', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  readonly: { fontSize: 15, color: '#555', paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, alignItems: 'center' },
  choice: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  choiceSelected: { backgroundColor: '#222', borderColor: '#222' },
  choiceText: { fontSize: 16 },
  choiceSub: { fontSize: 13, color: '#666', marginTop: 2 },
  choiceTextSelected: { color: '#fff' },
  notice: { fontSize: 14, color: '#8a5a00', backgroundColor: '#fff4e0', padding: 12, borderRadius: 8, marginTop: 8 },
  error: { color: '#c62828', fontSize: 14, marginTop: 8 },
  message: { color: '#2e7d32', fontSize: 14, marginTop: 8 },
  errorBox: { gap: 8 },
  link: { color: '#1565c0', fontSize: 14 },
  button: { backgroundColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16 },
});
