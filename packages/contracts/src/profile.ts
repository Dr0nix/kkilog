import { z } from 'zod';
import { CalorieTargetSchema, MacroTargetSchema, OnboardingRequestSchema, SEXES } from './onboarding';

export const ProfileSchema = z.object({
  nickname: z.string(),
  sex: z.enum(SEXES),
  // 출생연도로 저장하므로 오늘 기준으로 다시 계산한 값(spec 2.2)
  age: z.number().int(),
  height_cm: z.number(),
  target_weight_kg: z.number(),
  activity_level: z.number().int(),
  goal_months: z.number().int(),
  // 가장 최근 실측. 몸무게는 프로필에서 고치지 않고 체중 기록으로 남긴다
  latest_weight_kg: z.number().nullable(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// 지금 적용 중인 목표(가장 최근 calorie_targets 행)
export const CurrentCalorieTargetSchema = z.object({
  kcal: z.number().int(),
  clamped: z.boolean(),
  macros: MacroTargetSchema.nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
});
export type CurrentCalorieTarget = z.infer<typeof CurrentCalorieTargetSchema>;

// GET /api/profile
export const ProfileResponseSchema = z.object({
  profile: ProfileSchema,
  calorie_target: CurrentCalorieTargetSchema,
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

// PATCH /api/profile — 바꿀 항목만 보낸다. 몸무게는 받지 않는다(spec 2.2).
export const UpdateProfileRequestSchema = OnboardingRequestSchema.omit({ weight_kg: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0);
export type UpdateProfileRequest = z.input<typeof UpdateProfileRequestSchema>;

// 목표 칼로리에 영향을 주는 항목(성별·나이·키·목표 몸무게·운동 정도·목표 기간)
export const CALORIE_TARGET_FIELDS = [
  'sex',
  'age',
  'height_cm',
  'target_weight_kg',
  'activity_level',
  'goal_months',
] as const;

export const UpdateProfileResponseSchema = z.object({
  profile: ProfileSchema,
  // 목표 칼로리 관련 항목이 바뀌어 최근 체중으로 다시 정했으면 새 목표, 아니면 null
  new_calorie_target: CalorieTargetSchema.nullable(),
});
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;
