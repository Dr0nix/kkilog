import {
  ACTIVITY_LEVELS,
  type CalorieTarget,
  type OnboardingRequest,
  OnboardingRequestSchema,
  type Sex,
} from '@kkilog/contracts';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  type KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, UnauthorizedError, submitOnboarding } from '../src/api/client';

type NumberField = 'age' | 'height_cm' | 'weight_kg' | 'target_weight_kg' | 'goal_months';

const FIELD_LABELS: Record<keyof OnboardingRequest, string> = {
  nickname: '닉네임(1~20자)',
  sex: '성별',
  age: '나이(14~100)',
  height_cm: '키(100~250cm)',
  weight_kg: '현재 몸무게(20~300kg)',
  target_weight_kg: '목표 몸무게(20~300kg)',
  activity_level: '운동 정도',
  goal_months: '목표 기간(1~24개월, 정수)',
};

const NUMBER_FIELDS: { key: NumberField; label: string; placeholder: string; keyboard: KeyboardTypeOptions }[] = [
  { key: 'age', label: '나이', placeholder: '30', keyboard: 'number-pad' },
  { key: 'height_cm', label: '키 (cm)', placeholder: '170', keyboard: 'decimal-pad' },
  { key: 'weight_kg', label: '현재 몸무게 (kg)', placeholder: '70', keyboard: 'decimal-pad' },
  { key: 'target_weight_kg', label: '목표 몸무게 (kg)', placeholder: '65', keyboard: 'decimal-pad' },
  { key: 'goal_months', label: '목표 기간 (몇 개월 안에)', placeholder: '4', keyboard: 'number-pad' },
];

const DAYS_PER_MONTH = 30.44;

// 빈 칸은 NaN으로 넘겨 스키마가 거부하게 한다. 쉼표 소수점도 받는다.
function toNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text.replace(',', '.'));
}

export default function OnboardingScreen() {
  const [nickname, setNickname] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [numbers, setNumbers] = useState<Record<NumberField, string>>({
    age: '',
    height_cm: '',
    weight_kg: '',
    target_weight_kg: '',
    goal_months: '',
  });
  const [activityLevel, setActivityLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CalorieTarget | null>(null);

  async function submit() {
    const parsed = OnboardingRequestSchema.safeParse({
      nickname,
      sex,
      age: toNumber(numbers.age),
      height_cm: toNumber(numbers.height_cm),
      weight_kg: toNumber(numbers.weight_kg),
      target_weight_kg: toNumber(numbers.target_weight_kg),
      activity_level: activityLevel,
      goal_months: toNumber(numbers.goal_months),
    });
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => i.path[0]))] as (keyof OnboardingRequest)[];
      setError(`다시 확인해 주세요: ${fields.map((f) => FIELD_LABELS[f]).join(', ')}`);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await submitOnboarding(parsed.data);
      setResult(res.calorie_target);
    } catch (e) {
      if (e instanceof UnauthorizedError) return; // client가 코드 입력 화면으로 보낸다
      if (e instanceof ApiError && e.code === 'PROFILE_EXISTS') {
        router.replace('/home');
        return;
      }
      setError(
        e instanceof ApiError && e.code === 'UPSTREAM_UNAVAILABLE'
          ? '목표 칼로리를 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.'
          : '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <Result target={result} />;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>처음 한 번만 입력해 주세요</Text>

      <Text style={styles.label}>닉네임</Text>
      <TextInput style={styles.input} value={nickname} onChangeText={setNickname} maxLength={20} editable={!submitting} />

      <Text style={styles.label}>성별</Text>
      <View style={styles.row}>
        {(
          [
            ['male', '남'],
            ['female', '여'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.choice, styles.flex, sex === value && styles.choiceSelected]}
            onPress={() => setSex(value)}
            disabled={submitting}
          >
            <Text style={[styles.choiceText, sex === value && styles.choiceTextSelected]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {NUMBER_FIELDS.map((field) => (
        <View key={field.key}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            style={styles.input}
            value={numbers[field.key]}
            onChangeText={(text) => setNumbers((prev) => ({ ...prev, [field.key]: text }))}
            placeholder={field.placeholder}
            keyboardType={field.keyboard}
            editable={!submitting}
          />
        </View>
      ))}

      <Text style={styles.label}>운동 정도</Text>
      {ACTIVITY_LEVELS.map((activity) => (
        <Pressable
          key={activity.level}
          style={[styles.choice, activityLevel === activity.level && styles.choiceSelected]}
          onPress={() => setActivityLevel(activity.level)}
          disabled={submitting}
        >
          <Text style={[styles.choiceText, activityLevel === activity.level && styles.choiceTextSelected]}>
            {activity.level}. {activity.label}
          </Text>
          <Text style={[styles.choiceSub, activityLevel === activity.level && styles.choiceTextSelected]}>
            {activity.description}
          </Text>
        </Pressable>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={() => void submit()}>
        {submitting ? (
          <View style={styles.row}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>목표 칼로리 계산 중… (최대 1분)</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>목표 칼로리 계산하기</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Result({ target }: { target: CalorieTarget }) {
  const months = target.expected_days === null ? null : (target.expected_days / DAYS_PER_MONTH).toFixed(1);

  return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.label}>하루 목표 칼로리</Text>
      <Text style={styles.kcal}>{target.kcal.toLocaleString()} kcal</Text>

      {target.clamped ? (
        <Text style={styles.notice}>
          목표 기간 안에 도달하려면 하루 {target.kcal.toLocaleString()}kcal보다 적게 먹어야 해서, 최저 기준인{' '}
          {target.kcal.toLocaleString()}kcal로 맞췄어요.
          {months === null
            ? ' 이 섭취량으로는 도달 기간을 계산할 수 없어요.'
            : ` 이 섭취량이면 목표까지 약 ${months}개월(${target.expected_days}일) 걸려요.`}
        </Text>
      ) : (
        <>
          {months === null ? null : <Text style={styles.help}>목표까지 약 {months}개월</Text>}
          {target.reason ? <Text style={styles.help}>{target.reason}</Text> : null}
        </>
      )}

      <Pressable style={styles.button} onPress={() => router.replace('/home')}>
        <Text style={styles.buttonText}>시작하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, gap: 8 },
  center: { flex: 1, justifyContent: 'center', gap: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  label: { fontSize: 14, color: '#555', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1, alignItems: 'center' },
  choice: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  choiceSelected: { backgroundColor: '#222', borderColor: '#222' },
  choiceText: { fontSize: 16 },
  choiceSub: { fontSize: 13, color: '#666', marginTop: 2 },
  choiceTextSelected: { color: '#fff' },
  error: { color: '#c62828', fontSize: 14, marginTop: 8 },
  button: { backgroundColor: '#222', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16 },
  kcal: { fontSize: 40, fontWeight: '700' },
  notice: { fontSize: 15, color: '#8a5a00', backgroundColor: '#fff4e0', padding: 12, borderRadius: 8 },
  help: { fontSize: 14, color: '#555' },
});
