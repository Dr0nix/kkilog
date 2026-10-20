import { addDays } from './dates';
import { type MealTotals, sumMeal } from './meal';
import { TREND_ALPHA, TREND_ETA_MAX_DAYS, TREND_MIN_SPAN_DAYS, TREND_SLOPE_WINDOW_DAYS } from './params';

// 하루 체중값 = 그날 가장 마지막 기록(spec 5). 날짜 오름차순, 날짜당 하나.
export type DailyWeight = { date: string; weightKg: number };
// 기록이 없는 날은 weightKg가 null이고 추세는 전날 값을 그대로 잇는다.
export type TrendPoint = { date: string; weightKg: number | null; trendKg: number };

const round2 = (value: number) => Math.round(value * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;

// 일별 체중의 지수이동평균(spec 7.2). 첫 기록일부터 until까지 하루씩 만든다.
// 첫 추세값은 첫 체중. 기록이 있는 날만 trend += α × (체중 − trend).
export function weightTrend(daily: readonly DailyWeight[], until: string): TrendPoint[] {
  const first = daily[0];
  if (!first) return [];
  const byDate = new Map(daily.map((d) => [d.date, d.weightKg]));
  const points: TrendPoint[] = [];
  let trend = first.weightKg;
  for (let date = first.date; date <= until; date = addDays(date, 1)) {
    const weight = byDate.get(date) ?? null;
    if (weight !== null) trend += TREND_ALPHA * (weight - trend);
    points.push({ date, weightKg: weight, trendKg: round2(trend) });
  }
  return points;
}

// 최근 TREND_SLOPE_WINDOW_DAYS일 추세 변화를 주 단위로(kg/주). 기록 기간이 짧으면 창을 줄이고,
// TREND_MIN_SPAN_DAYS보다 짧으면 null. points는 weightTrend 결과(하루 간격, 오름차순).
export function trendSlopeKgPerWeek(points: readonly TrendPoint[]): number | null {
  const last = points.at(-1);
  if (!last) return null;
  const span = Math.min(TREND_SLOPE_WINDOW_DAYS, points.length - 1);
  if (span < TREND_MIN_SPAN_DAYS) return null;
  const start = points[points.length - 1 - span];
  if (!start) return null;
  return round2(((last.trendKg - start.trendKg) / span) * 7);
}

export type GoalProgress =
  | { status: 'reached'; remainingKg: number }
  | { status: 'on_track'; remainingKg: number; etaDate: string }
  // 목표 반대로 가거나 거의 변화가 없거나, 이 속도면 TREND_ETA_MAX_DAYS보다 오래 걸린다
  | { status: 'not_progressing'; remainingKg: number }
  | { status: 'insufficient_data'; remainingKg: number };

// 목표까지 남은 양과 이 속도 유지 시 도달 예상일(spec 2.5). 남은 양은 추세값 기준(+면 빼야 하고 −면 늘려야 함).
// 감량·증량 방향은 시작 체중(첫 기록)과 목표로 정한다.
export function goalProgress(args: {
  startKg: number;
  trendKg: number;
  targetKg: number;
  slopeKgPerWeek: number | null;
  today: string;
}): GoalProgress {
  const remainingKg = round1(args.trendKg - args.targetKg);
  const direction = Math.sign(args.startKg - args.targetKg); // 1: 감량, -1: 증량, 0: 유지
  if (direction === 0 || remainingKg * direction <= 0) return { status: 'reached', remainingKg };
  if (args.slopeKgPerWeek === null) return { status: 'insufficient_data', remainingKg };
  // 감량이면 기울기가 음수, 증량이면 양수여야 목표 쪽으로 가는 것이다.
  const perWeek = -args.slopeKgPerWeek * direction;
  if (perWeek <= 0) return { status: 'not_progressing', remainingKg };
  // 5 ÷ (0.7 ÷ 7)이 50.000…1이 되는 부동소수점 오차를 지우고 올림한다.
  const days = Math.ceil(Number(((Math.abs(remainingKg) * 7) / perWeek).toFixed(6)));
  if (days > TREND_ETA_MAX_DAYS) return { status: 'not_progressing', remainingKg };
  return { status: 'on_track', remainingKg, etaDate: addDays(args.today, days) };
}

// 기록이 있는 날들의 하루 평균 섭취. 기록이 없는 날은 0kcal로 보지 않고 뺀다(안 적은 날일 가능성이 커서).
// dayTotals는 날짜별 끼니 합계 목록(끼니가 하나도 없는 날은 넣지 않는다).
export function averageDailyIntake(dayTotals: readonly MealTotals[]): MealTotals | null {
  if (dayTotals.length === 0) return null;
  const sum = sumMeal(dayTotals);
  const n = dayTotals.length;
  return {
    kcal: Math.round(sum.kcal / n),
    carb_g: round1(sum.carb_g / n),
    protein_g: round1(sum.protein_g / n),
    fat_g: round1(sum.fat_g / n),
  };
}

// 날짜별로 끼니 합계를 묶는다. 하루 합계 = 그날 끼니 합계의 합(spec 5).
export function totalsByDate(meals: readonly { date: string; totals: MealTotals }[]): Map<string, MealTotals> {
  const grouped = new Map<string, MealTotals[]>();
  for (const meal of meals) grouped.set(meal.date, [...(grouped.get(meal.date) ?? []), meal.totals]);
  return new Map([...grouped].map(([date, list]) => [date, sumMeal(list)]));
}
