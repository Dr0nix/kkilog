import { CALORIE_TARGET_FIELDS, type Profile, type Sex, type UpdateProfileRequestSchema } from '@kkilog/contracts';
import type { z } from 'zod';

// 프로필에서 사용자가 고칠 수 있는 값(몸무게 제외)
export type EditableProfile = {
  nickname: string;
  sex: Sex;
  age: number;
  height_cm: number;
  target_weight_kg: number;
  activity_level: number;
  goal_months: number;
};

export type ProfileUpdatePlan = { next: EditableProfile; recalculate: boolean };

// 바뀐 항목을 합치고, 목표 칼로리에 영향을 주는 항목이 실제로 바뀌었는지 본다(spec 2.2).
// 같은 값을 다시 보낸 건 바뀐 것으로 보지 않는다(Gemini를 부르지 않음).
export function planProfileUpdate(
  current: EditableProfile,
  body: z.output<typeof UpdateProfileRequestSchema>,
): ProfileUpdatePlan {
  const next: EditableProfile = { ...current, ...body };
  const recalculate = CALORIE_TARGET_FIELDS.some((field) => next[field] !== current[field]);
  return { next, recalculate };
}

export function toEditable(profile: Profile): EditableProfile {
  return {
    nickname: profile.nickname,
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.height_cm,
    target_weight_kg: profile.target_weight_kg,
    activity_level: profile.activity_level,
    goal_months: profile.goal_months,
  };
}
