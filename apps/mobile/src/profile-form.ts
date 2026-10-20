import type { Profile, Sex } from '@kkilog/contracts';

// 프로필 수정 화면의 입력값. 숫자 칸은 입력 중인 글자 그대로 둔다.
export type NumberField = 'age' | 'height_cm' | 'target_weight_kg' | 'goal_months';
export type Form = { nickname: string; sex: Sex; activity_level: number } & Record<NumberField, string>;

export function toForm(profile: Profile): Form {
  return {
    nickname: profile.nickname,
    sex: profile.sex,
    activity_level: profile.activity_level,
    age: String(profile.age),
    height_cm: String(profile.height_cm),
    target_weight_kg: String(profile.target_weight_kg),
    goal_months: String(profile.goal_months),
  };
}

function toNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text.replace(',', '.'));
}

// 바뀐 항목만 보낸다. 같은 값은 빼서 서버가 목표를 괜히 다시 정하지 않게 한다.
export function changes(profile: Profile, form: Form): Record<string, unknown> {
  const next: Record<string, unknown> = {
    nickname: form.nickname.trim(),
    sex: form.sex,
    activity_level: form.activity_level,
    age: toNumber(form.age),
    height_cm: toNumber(form.height_cm),
    target_weight_kg: toNumber(form.target_weight_kg),
    goal_months: toNumber(form.goal_months),
  };
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => profile[key as keyof Profile] !== value));
}
