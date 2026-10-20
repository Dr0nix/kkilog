import { z } from 'zod';
import { MealSchema, MealTotalsSchema } from './meals';

// 'YYYY-MM-DD'이고 실제로 있는 날짜(2026-02-30 같은 값은 거부)
export const LocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

// GET /api/home?date= — 없으면 오늘(프로필 타임존)
export const HomeQuerySchema = z.object({ date: LocalDateSchema.optional() });

// 하루 목표. 탄단지 목표가 없는 사용자(calorie-target/v1)는 그램이 null
export const DailyTargetSchema = z.object({
  kcal: z.number().int(),
  carb_g: z.number().nullable(),
  protein_g: z.number().nullable(),
  fat_g: z.number().nullable(),
});
export type DailyTarget = z.infer<typeof DailyTargetSchema>;

export const HomeResponseSchema = z.object({
  date: z.string(),
  today: z.string(),
  // 그날 끼니들의 현재 ok 분석 합계. 분석이 실패했거나 아직 없는 끼니는 빠진다(spec 2.3)
  totals: MealTotalsSchema,
  // 그날이 끝날 때 유효했던 목표(spec 5). 그날 이후에 온보딩했으면 null
  target: DailyTargetSchema.nullable(),
  // 먹은 시각 순
  meals: z.array(MealSchema),
  weight: z.object({
    // 그날 체중을 기록했는지
    recorded: z.boolean(),
    // 그날까지의 가장 최근 실측
    latest: z.object({ date: z.string(), weight_kg: z.number() }).nullable(),
  }),
});
export type HomeResponse = z.infer<typeof HomeResponseSchema>;
