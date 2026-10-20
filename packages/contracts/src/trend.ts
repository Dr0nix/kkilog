import { z } from 'zod';
import { MealTotalsSchema } from './meals';

// GET /api/trend?days= — 그래프로 보여줄 기간(오늘 포함). 추세는 전체 기록으로 계산하고 이 기간만 잘라 보낸다.
export const TREND_DAYS = { min: 7, max: 365, default: 30 } as const;

export const TrendQuerySchema = z.object({
  days: z.coerce.number().int().min(TREND_DAYS.min).max(TREND_DAYS.max).default(TREND_DAYS.default),
});

export const GOAL_STATUSES = ['reached', 'on_track', 'not_progressing', 'insufficient_data'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const TrendResponseSchema = z.object({
  today: z.string(),
  target_weight_kg: z.number(),
  // 하루 간격. 기록이 없는 날은 weight_kg가 null이고 추세는 이어진다. 첫 기록 전 날짜는 없다.
  points: z.array(z.object({ date: z.string(), weight_kg: z.number().nullable(), trend_kg: z.number() })),
  // 가장 최근 실측(그날의 마지막 기록)
  latest: z.object({ date: z.string(), weight_kg: z.number() }).nullable(),
  // 오늘 기준 추세값
  trend_kg: z.number().nullable(),
  // 최근 14일 추세 기울기(kg/주). 기록 기간이 짧으면 null
  slope_kg_per_week: z.number().nullable(),
  // 목표까지 남은 kg(추세 기준, +면 빼야 하고 −면 늘려야 함)과 이 속도 유지 시 도달 예상일
  goal: z
    .object({
      status: z.enum(GOAL_STATUSES),
      remaining_kg: z.number(),
      eta_date: z.string().nullable(),
    })
    .nullable(),
  // 오늘을 뺀 최근 7일 중 기록한 날의 하루 평균 섭취와 그 날들의 평균 목표 kcal
  intake: z.object({
    days: z.number().int(),
    logged_days: z.number().int(),
    average: MealTotalsSchema.nullable(),
    target_kcal: z.number().int().nullable(),
  }),
});
export type TrendResponse = z.infer<typeof TrendResponseSchema>;
