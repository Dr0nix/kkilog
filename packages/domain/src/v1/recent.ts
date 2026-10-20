import type { DailyTarget } from './daily-target';
import type { MealTotals } from './meal';
import { PATTERN_OVER_KCAL_RATIO, PATTERN_PROTEIN_SHORT_RATIO } from './params';
import { averageDailyIntake, totalsByDate } from './trend';

export type RecentMeal = { date: string; mealType: string; totals: MealTotals };

export type RecentSummary = {
  days: number;
  // 끼니를 하나라도 기록한 날 수. 아래 값은 전부 이 날들만으로 계산한다(안 적은 날은 0kcal로 보지 않음).
  loggedDays: number;
  average: MealTotals | null;
  // 그 날들에 유효했던 목표 kcal 평균과, 평균 섭취 − 평균 목표(넘으면 +)
  averageTargetKcal: number | null;
  averageVsTargetKcal: number | null;
  overTargetDays: number;
  // 단백질 목표가 없는 날(calorie-target/v1)은 세지 않는다. 그런 날만 있으면 null
  proteinShortDays: number | null;
  lateNightDays: number;
};

// 최근 며칠의 기록을 조언 입력용으로 요약한다(spec 6.2 장기 맥락). 숫자·패턴은 서버가 계산하고 모델에게 맡기지 않는다.
// meals는 그 기간 끼니들의 현재 ok 분석 합계, targets는 날짜별로 유효했던 목표.
export function summarizeRecentDays(
  meals: readonly RecentMeal[],
  targets: ReadonlyMap<string, DailyTarget>,
  days: number,
): RecentSummary {
  const byDate = totalsByDate(meals);
  const dates = [...byDate.keys()];
  const average = averageDailyIntake([...byDate.values()]);

  const targetKcals = dates.flatMap((date) => {
    const target = targets.get(date);
    return target ? [target.kcal] : [];
  });
  const averageTargetKcal = targetKcals.length
    ? Math.round(targetKcals.reduce((sum, kcal) => sum + kcal, 0) / targetKcals.length)
    : null;

  let overTargetDays = 0;
  let proteinShortDays: number | null = null;
  for (const date of dates) {
    const totals = byDate.get(date);
    const target = targets.get(date);
    if (!totals || !target) continue;
    if (totals.kcal > target.kcal * PATTERN_OVER_KCAL_RATIO) overTargetDays++;
    if (target.protein_g !== null) {
      proteinShortDays = (proteinShortDays ?? 0) + (totals.protein_g < target.protein_g * PATTERN_PROTEIN_SHORT_RATIO ? 1 : 0);
    }
  }

  return {
    days,
    loggedDays: dates.length,
    average,
    averageTargetKcal,
    averageVsTargetKcal: average && averageTargetKcal !== null ? average.kcal - averageTargetKcal : null,
    overTargetDays,
    proteinShortDays,
    lateNightDays: new Set(meals.filter((m) => m.mealType === 'late_night').map((m) => m.date)).size,
  };
}
