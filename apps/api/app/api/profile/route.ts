import {
  type ProfileResponse,
  UpdateProfileRequestSchema,
  type UpdateProfileResponse,
} from '@kkilog/contracts';
import { birthYearFromAge, daysUntilMonthsLater, localDate } from '@kkilog/domain';
import { buildCalorieTargetInput } from '@/src/llm/calorie-target';
import { planProfileUpdate, toEditable } from '@/src/profile/update';
import { authenticate } from '@/src/server/auth';
import { decideCalorieTarget, insertCalorieTarget, toCalorieTargetResponse } from '@/src/server/calorie-target';
import { db } from '@/src/server/db';
import { GeminiError } from '@/src/server/gemini';
import { errorJson, privateJson } from '@/src/server/http';
import { currentCalorieTarget, loadProfile } from '@/src/server/profile';

// 목표 칼로리를 다시 정할 때 Gemini 호출(재시도 포함)을 기다린다.
export const maxDuration = 60;

const today = (timezone: string) => localDate(new Date(), timezone);

export async function GET(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const record = await loadProfile(userId, today);
  if (!record) return errorJson('ONBOARDING_REQUIRED', 409);

  return privateJson<ProfileResponse>({ profile: record.profile, calorie_target: await currentCalorieTarget(userId) });
}

// 바꾼 항목만 받는다. 목표 칼로리에 영향을 주는 항목이 바뀌면 최근 체중으로 Gemini가 목표를 다시 정하고,
// 목표 기간은 지금부터 다시 센다(spec 2.2). Gemini가 실패하면 아무것도 저장하지 않는다.
export async function PATCH(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const record = await loadProfile(userId, today);
  if (!record) return errorJson('ONBOARDING_REQUIRED', 409);

  const parsed = UpdateProfileRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorJson('INVALID_REQUEST', 400);

  const now = today(record.timezone);
  const { next, recalculate } = planProfileUpdate(toEditable(record.profile), parsed.data);
  // 나이를 고치지 않았으면 출생연도를 그대로 둔다(같은 나이를 다시 계산하면 ±1년 흔들릴 수 있음).
  const birthYear = next.age === record.profile.age ? record.birthYear : birthYearFromAge(now, next.age);

  let target = null;
  if (recalculate) {
    const weightKg = record.profile.latest_weight_kg;
    if (weightKg === null) throw new Error('profile without weight log');
    try {
      target = await decideCalorieTarget(
        buildCalorieTargetInput({
          sex: next.sex,
          age: next.age,
          height_cm: next.height_cm,
          weight_kg: weightKg,
          target_weight_kg: next.target_weight_kg,
          activity_level: next.activity_level,
          goal_days: daysUntilMonthsLater(now, next.goal_months),
        }),
      );
    } catch (error) {
      if (!(error instanceof GeminiError)) throw error;
      console.error('profile: calorie target failed', error);
      return errorJson('UPSTREAM_UNAVAILABLE', 503);
    }
  }

  const sql = db();
  const update = sql`
    update kkilog.profiles set
      nickname = ${next.nickname}, sex = ${next.sex}, birth_year = ${birthYear}, height_cm = ${next.height_cm},
      target_weight_kg = ${next.target_weight_kg}, activity_level = ${next.activity_level},
      goal_months = ${next.goal_months}, updated_at = now()
    where user_id = ${userId}`;
  await sql.transaction(target ? [update, insertCalorieTarget(sql, userId, target)] : [update]);

  return privateJson<UpdateProfileResponse>({
    profile: { ...next, latest_weight_kg: record.profile.latest_weight_kg },
    new_calorie_target: target ? toCalorieTargetResponse(target) : null,
  });
}
