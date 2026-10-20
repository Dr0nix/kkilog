import 'server-only';
import type { HomeResponse } from '@kkilog/contracts';
import { dayTotals } from '../meals/day';
import { db } from './db';
import { findEntriesOn, toMealResponse } from './meals';
import { targetsOn } from './targets';

async function weightOn(userId: string, date: string): Promise<HomeResponse['weight']> {
  const rows = await db()`
    select local_date::text as date, weight_kg from kkilog.weight_logs
    where user_id = ${userId} and local_date <= ${date}
    order by local_date desc, measured_at desc limit 1`;
  const latest = rows[0] ? { date: rows[0].date as string, weight_kg: Number(rows[0].weight_kg) } : null;
  return { recorded: latest?.date === date, latest };
}

export async function buildHome(args: {
  userId: string;
  date: string;
  today: string;
  timeZone: string;
}): Promise<HomeResponse> {
  const [entries, targets, weight] = await Promise.all([
    findEntriesOn(args.userId, args.date),
    targetsOn(args.userId, [args.date], args.timeZone),
    weightOn(args.userId, args.date),
  ]);
  const meals = await Promise.all(entries.map(toMealResponse));
  return {
    date: args.date,
    today: args.today,
    totals: dayTotals(meals),
    target: targets.get(args.date) ?? null,
    meals,
    weight,
  };
}
