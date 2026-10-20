import { type GoalStatus, MEAL_TYPE_LABELS, type MealType } from '@kkilog/contracts';
import {
  type DailyTarget,
  type MealItemInput,
  type MealTotals,
  type RecentHighlight,
  type RecentSummary,
  localTime,
  pickRecentHighlight,
  remainingToTarget,
  sumMeal,
} from '@kkilog/domain';
import { z } from 'zod';
import { jsonSchemaForGemini, parseJsonWith } from './json';

// 프롬프트 파일: prompts/meal-advice/v2.md(v1에 최근 기록·체중 추세 맥락 추가). 프롬프트·출력 스키마를 바꾸면 버전을 올린다(기존 파일 수정 금지).
export const MEAL_ADVICE_PROMPT = { name: 'meal-advice', version: 'v2' } as const;
export const MEAL_ADVICE_PROMPT_VERSION = `${MEAL_ADVICE_PROMPT.name}/${MEAL_ADVICE_PROMPT.version}`;

// 프롬프트는 200자 이내를 요구한다. 조금 넘는 건 받아 주고, 크게 벗어나면 응답 이상으로 본다.
export const MealAdviceOutputSchema = z.object({
  advice: z.string().trim().min(1).max(300),
});
export type MealAdviceOutput = z.infer<typeof MealAdviceOutputSchema>;

export const mealAdviceResponseJsonSchema = jsonSchemaForGemini(MealAdviceOutputSchema);

type AdviceMeal = { meal_type: string; eaten_at: string; totals: MealTotals };

// 조언 호출 입력(spec 6.2). 합계·남은 양은 서버가 계산해서 넣는다(LLM에게 계산시키지 않음).
export type MealAdviceLlmInput = {
  this_meal: AdviceMeal & {
    items: Pick<MealItemInput, 'name' | 'quantity' | 'unit' | 'kcal' | 'carb_g' | 'protein_g' | 'fat_g'>[];
  };
  earlier_meals_today: AdviceMeal[];
  today_totals: MealTotals;
  daily_target: DailyTarget;
  remaining: DailyTarget;
  // 장기 맥락(v2). 이 끼니 날짜 전날까지 최근 며칠(오늘 제외)
  recent_days: {
    days: number;
    logged_days: number;
    average: MealTotals | null;
    average_target_kcal: number | null;
    average_vs_target_kcal: number | null;
    over_target_days: number;
    protein_short_days: number | null;
    late_night_days: number;
  };
  // 체중 추세(spec 7.2와 같은 계산). 기록이 없으면 null
  weight: {
    trend_kg: number;
    target_weight_kg: number;
    remaining_kg: number;
    slope_kg_per_week: number | null;
    goal_status: GoalStatus;
    eta_date: string | null;
  } | null;
  // 덧붙일 최근 흐름 하나. 서버가 고른다(모델이 우선순위를 매번 지키지 않아서). 없으면 null
  recent_highlight:
    | { kind: 'protein_short_repeat' | 'late_night_repeat' | 'over_target_repeat'; days: number }
    | { kind: 'average_over_not_progressing'; average_vs_target_kcal: number }
    | { kind: 'on_track'; eta_date: string | null }
    | null;
};

function toLlmHighlight(
  highlight: RecentHighlight | null,
  weight: AdviceWeight | null,
): MealAdviceLlmInput['recent_highlight'] {
  if (!highlight) return null;
  switch (highlight.kind) {
    case 'average_over_not_progressing':
      return { kind: highlight.kind, average_vs_target_kcal: highlight.averageVsTargetKcal };
    case 'on_track':
      return { kind: highlight.kind, eta_date: weight?.eta_date ?? null };
    default:
      return { kind: highlight.kind, days: highlight.days };
  }
}

export type AdviceWeight = NonNullable<MealAdviceLlmInput['weight']>;

export type AdviceMealSource = { mealType: MealType; eatenAt: Date; totals: MealTotals };

export function buildMealAdviceInput(args: {
  thisMeal: AdviceMealSource & { items: readonly MealItemInput[] };
  earlierMeals: readonly AdviceMealSource[];
  target: DailyTarget;
  timeZone: string;
  recent: RecentSummary;
  weight: AdviceWeight | null;
}): MealAdviceLlmInput {
  const summary = (meal: AdviceMealSource): AdviceMeal => ({
    meal_type: MEAL_TYPE_LABELS[meal.mealType],
    eaten_at: localTime(meal.eatenAt, args.timeZone),
    totals: meal.totals,
  });
  const todayTotals = sumMeal([...args.earlierMeals.map((m) => m.totals), args.thisMeal.totals]);
  const remaining = remainingToTarget(args.target, todayTotals);
  const highlight = pickRecentHighlight({
    recent: args.recent,
    goalStatus: args.weight?.goal_status ?? null,
    todayProteinShort: remaining.protein_g !== null && remaining.protein_g > 0,
    thisMealLateNight: args.thisMeal.mealType === 'late_night',
    todayOverTarget: remaining.kcal < 0,
  });
  return {
    this_meal: {
      ...summary(args.thisMeal),
      items: args.thisMeal.items.map(({ name, quantity, unit, kcal, carb_g, protein_g, fat_g }) => ({
        name,
        quantity,
        unit,
        kcal,
        carb_g,
        protein_g,
        fat_g,
      })),
    },
    earlier_meals_today: args.earlierMeals.map(summary),
    today_totals: todayTotals,
    daily_target: args.target,
    remaining,
    recent_days: {
      days: args.recent.days,
      logged_days: args.recent.loggedDays,
      average: args.recent.average,
      average_target_kcal: args.recent.averageTargetKcal,
      average_vs_target_kcal: args.recent.averageVsTargetKcal,
      over_target_days: args.recent.overTargetDays,
      protein_short_days: args.recent.proteinShortDays,
      late_night_days: args.recent.lateNightDays,
    },
    weight: args.weight,
    recent_highlight: toLlmHighlight(highlight, args.weight),
  };
}

export function parseMealAdviceOutput(text: string): MealAdviceOutput | null {
  return parseJsonWith(MealAdviceOutputSchema, text);
}
