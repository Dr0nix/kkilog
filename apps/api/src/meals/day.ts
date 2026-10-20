import type { Meal } from '@kkilog/contracts';
import { type MealTotals, sumMeal } from '@kkilog/domain';

// 하루 합계 = 그날 끼니들의 현재 ok 분석 합계(spec 5). 실패·분석 전 끼니는 빠진다(spec 2.3).
export function dayTotals(meals: readonly Meal[]): MealTotals {
  return sumMeal(meals.flatMap((meal) => (meal.analysis?.status === 'ok' ? [meal.analysis.totals] : [])));
}
