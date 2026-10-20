import 'server-only';
import type { TrendResponse } from '@kkilog/contracts';
import {
  type DailyWeight,
  INTAKE_AVERAGE_DAYS,
  addDays,
  averageDailyIntake,
  goalProgress,
  totalsByDate,
  trendSlopeKgPerWeek,
  weightTrend,
} from '@kkilog/domain';
import { db } from './db';
import { targetsOn } from './targets';

// 하루 체중값 = 그날 가장 마지막 기록(spec 5). 추세는 처음부터 이어서 계산하므로 전체를 읽는다.
async function dailyWeights(userId: string): Promise<DailyWeight[]> {
  const rows = await db()`
    select distinct on (local_date) local_date::text as date, weight_kg from kkilog.weight_logs
    where user_id = ${userId} order by local_date, measured_at desc`;
  return rows.map((row) => ({ date: row.date as string, weightKg: Number(row.weight_kg) }));
}

// from~to(포함) 끼니마다 현재 ok 분석의 합계. ok 분석이 없는 끼니·지운 끼니는 뺀다(spec 5).
async function mealTotals(userId: string, from: string, to: string) {
  const rows = await db()`
    select e.local_date::text as date, a.kcal, a.carb_g, a.protein_g, a.fat_g
    from kkilog.meal_entries e
    join lateral (
      select kcal, carb_g, protein_g, fat_g from kkilog.meal_analyses
      where entry_id = e.id and status = 'ok' order by created_at desc limit 1
    ) a on true
    where e.user_id = ${userId} and e.deleted_at is null and e.local_date between ${from} and ${to}`;
  return rows.map((row) => ({
    date: row.date as string,
    totals: {
      kcal: Number(row.kcal),
      carb_g: Number(row.carb_g),
      protein_g: Number(row.protein_g),
      fat_g: Number(row.fat_g),
    },
  }));
}

export async function buildTrend(args: {
  userId: string;
  today: string;
  days: number;
  targetWeightKg: number;
  timeZone: string;
}): Promise<TrendResponse> {
  const daily = await dailyWeights(args.userId);
  const points = weightTrend(daily, args.today);
  const slope = trendSlopeKgPerWeek(points);
  const first = daily[0];
  const last = daily.at(-1);
  const trendKg = points.at(-1)?.trendKg ?? null;
  const progress =
    first && trendKg !== null
      ? goalProgress({
          startKg: first.weightKg,
          trendKg,
          targetKg: args.targetWeightKg,
          slopeKgPerWeek: slope,
          today: args.today,
        })
      : null;

  // 오늘은 아직 끝나지 않아서 뺀다.
  const byDate = totalsByDate(
    await mealTotals(args.userId, addDays(args.today, -INTAKE_AVERAGE_DAYS), addDays(args.today, -1)),
  );
  const targets = [...(await targetsOn(args.userId, [...byDate.keys()], args.timeZone)).values()].map((t) => t.kcal);

  const since = addDays(args.today, -(args.days - 1));
  return {
    today: args.today,
    target_weight_kg: args.targetWeightKg,
    points: points
      .filter((p) => p.date >= since)
      .map((p) => ({ date: p.date, weight_kg: p.weightKg, trend_kg: p.trendKg })),
    latest: last ? { date: last.date, weight_kg: last.weightKg } : null,
    trend_kg: trendKg,
    slope_kg_per_week: slope,
    goal: progress
      ? {
          status: progress.status,
          remaining_kg: progress.remainingKg,
          eta_date: progress.status === 'on_track' ? progress.etaDate : null,
        }
      : null,
    intake: {
      days: INTAKE_AVERAGE_DAYS,
      logged_days: byDate.size,
      average: averageDailyIntake([...byDate.values()]),
      target_kcal: targets.length ? Math.round(targets.reduce((a, b) => a + b, 0) / targets.length) : null,
    },
  };
}
