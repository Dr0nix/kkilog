import { z } from 'zod';

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

// 운동 정도 보기(spec 2.2). 앱 화면과 목표 칼로리 프롬프트 입력에 같이 쓴다.
export const ACTIVITY_LEVELS = [
  { level: 1, label: '거의 안 움직임', description: '앉아서 일하고 운동 안 함' },
  { level: 2, label: '가벼움', description: '주 1~2회 가벼운 운동' },
  { level: 3, label: '보통', description: '주 3~4회 운동' },
  { level: 4, label: '활발', description: '주 5~6회 운동' },
  { level: 5, label: '매우 활발', description: '매일 고강도 운동 또는 육체노동' },
] as const;

// 소수 첫째 자리까지만 저장한다(numeric(4,1)).
export const oneDecimal = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .transform((value) => Math.round(value * 10) / 10);

// POST /api/onboarding
export const OnboardingRequestSchema = z.object({
  // DB의 char_length와 맞추려고 UTF-16 길이가 아니라 문자 수로 센다.
  nickname: z
    .string()
    .trim()
    .refine((value) => {
      const length = Array.from(value).length;
      return length >= 1 && length <= 20;
    }),
  sex: z.enum(SEXES),
  age: z.number().int().min(14).max(100),
  height_cm: oneDecimal(100, 250),
  weight_kg: oneDecimal(20, 300),
  target_weight_kg: oneDecimal(20, 300),
  activity_level: z.number().int().min(1).max(5),
  goal_months: z.number().int().min(1).max(24),
});
export type OnboardingRequest = z.input<typeof OnboardingRequestSchema>;

// 하루 탄단지 목표(spec 7.1). 비율은 Gemini가 정하고, 그램은 서버가 최종 kcal로 계산한다.
export const MacroTargetSchema = z.object({
  carb_pct: z.number().int(),
  protein_pct: z.number().int(),
  fat_pct: z.number().int(),
  carb_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
});
export type MacroTarget = z.infer<typeof MacroTargetSchema>;

export const CalorieTargetSchema = z.object({
  kcal: z.number().int(),
  // 하한으로 맞췄는지. true면 expected_days는 하한 기준 예상 기간(spec 7.1)
  clamped: z.boolean(),
  expected_days: z.number().int().nullable(),
  // calorie-target/v1로 정한 목표엔 없다(null)
  macros: MacroTargetSchema.nullable(),
  reason: z.string().nullable(),
});
export type CalorieTarget = z.infer<typeof CalorieTargetSchema>;

export const OnboardingResponseSchema = z.object({
  calorie_target: CalorieTargetSchema,
});
export type OnboardingResponse = z.infer<typeof OnboardingResponseSchema>;
