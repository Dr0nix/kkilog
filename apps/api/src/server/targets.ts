import 'server-only';
import type { DailyTarget } from '@kkilog/domain';
import { db } from './db';

type Numeric = string | number;
const nullableNumber = (value: Numeric | null) => (value === null ? null : Number(value));

// 날짜마다 그날이 끝날 때 유효했던 목표(spec 5: 과거 날짜는 그날 기준으로 유효했던 행).
// 그날 이후에 온보딩했으면 그 날짜는 결과에 없다.
export async function targetsOn(
  userId: string,
  dates: readonly string[],
  timeZone: string,
): Promise<Map<string, DailyTarget>> {
  if (dates.length === 0) return new Map();
  const rows = await db()`
    select d.day::text as date, t.kcal, t.carb_g, t.protein_g, t.fat_g from unnest(${dates}::date[]) as d(day)
    join lateral (
      select kcal, carb_g, protein_g, fat_g from kkilog.calorie_targets
      where user_id = ${userId} and created_at < ((d.day + 1)::timestamp at time zone ${timeZone})
      order by created_at desc limit 1
    ) t on true`;
  return new Map(
    rows.map((row) => [
      row.date as string,
      {
        kcal: Number(row.kcal),
        carb_g: nullableNumber(row.carb_g as Numeric | null),
        protein_g: nullableNumber(row.protein_g as Numeric | null),
        fat_g: nullableNumber(row.fat_g as Numeric | null),
      },
    ]),
  );
}
