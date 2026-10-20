import 'server-only';
import type { CurrentCalorieTarget, Profile, Sex } from '@kkilog/contracts';
import { ageOn } from '@kkilog/domain';
import { toIso } from '../meals/view';
import { db } from './db';

type Numeric = string | number;

export type ProfileRecord = { profile: Profile; birthYear: number; timezone: string };

// 프로필 + 가장 최근 체중. 프로필이 없으면 null(온보딩 전).
export async function loadProfile(userId: string, today: (timezone: string) => string): Promise<ProfileRecord | null> {
  const rows = await db()`
    select p.nickname, p.sex, p.birth_year, p.height_cm, p.target_weight_kg, p.activity_level, p.goal_months, p.timezone,
      (select weight_kg from kkilog.weight_logs w where w.user_id = p.user_id
       order by local_date desc, measured_at desc limit 1) as latest_weight_kg
    from kkilog.profiles p where p.user_id = ${userId}`;
  const row = rows[0];
  if (!row) return null;
  const timezone = row.timezone as string;
  const birthYear = Number(row.birth_year);
  return {
    birthYear,
    timezone,
    profile: {
      nickname: row.nickname as string,
      sex: row.sex as Sex,
      age: ageOn(today(timezone), birthYear),
      height_cm: Number(row.height_cm),
      target_weight_kg: Number(row.target_weight_kg),
      activity_level: Number(row.activity_level),
      goal_months: Number(row.goal_months),
      latest_weight_kg: row.latest_weight_kg === null ? null : Number(row.latest_weight_kg as Numeric),
    },
  };
}

// 지금 적용 중인 목표 = 가장 최근 calorie_targets 행(spec 5). 온보딩에서 항상 만들어진다.
export async function currentCalorieTarget(userId: string): Promise<CurrentCalorieTarget> {
  const rows = await db()`
    select kcal, clamped, carb_pct, protein_pct, fat_pct, carb_g, protein_g, fat_g, reason, created_at
    from kkilog.calorie_targets where user_id = ${userId} order by created_at desc limit 1`;
  const row = rows[0];
  if (!row) throw new Error('calorie target not found');
  return {
    kcal: Number(row.kcal),
    clamped: row.clamped as boolean,
    // 0003 CHECK가 여섯 칸이 전부 있거나 전부 없음을 보장한다.
    macros:
      row.carb_pct === null
        ? null
        : {
            carb_pct: Number(row.carb_pct),
            protein_pct: Number(row.protein_pct),
            fat_pct: Number(row.fat_pct),
            carb_g: Number(row.carb_g),
            protein_g: Number(row.protein_g),
            fat_g: Number(row.fat_g),
          },
    reason: row.reason as string | null,
    created_at: toIso(row.created_at as Date | string),
  };
}
