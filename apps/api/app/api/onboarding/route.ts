import { OnboardingRequestSchema, type OnboardingResponse } from '@kkilog/contracts';
import { birthYearFromAge, daysUntilMonthsLater, localDate } from '@kkilog/domain';
import { buildCalorieTargetInput } from '@/src/llm/calorie-target';
import { authenticate } from '@/src/server/auth';
import { decideCalorieTarget } from '@/src/server/calorie-target';
import { db } from '@/src/server/db';
import { GeminiError } from '@/src/server/gemini';
import { errorJson, privateJson } from '@/src/server/http';

// Gemini 호출(재시도 포함)을 기다린다.
export const maxDuration = 60;

// 온보딩 때는 프로필이 없으므로 기본 타임존을 쓴다(profiles.timezone 기본값과 같다).
const DEFAULT_TIMEZONE = 'Asia/Seoul';

function isProfileConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === 'profiles_pkey'
  );
}

// 프로필 + 첫 체중 + 목표 칼로리를 한 트랜잭션으로 저장한다(spec 2.2).
// Gemini가 실패하면 아무것도 저장하지 않는다.
export async function POST(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const parsed = OnboardingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorJson('INVALID_REQUEST', 400);
  const body = parsed.data;

  const sql = db();
  // Gemini 호출 전에 먼저 막는다(무료 한도 아끼기). 동시 요청은 아래 트랜잭션의 PK 충돌로 막힌다.
  const existing = await sql`select 1 from kkilog.profiles where user_id = ${userId}`;
  if (existing.length > 0) return errorJson('PROFILE_EXISTS', 409);

  const today = localDate(new Date(), DEFAULT_TIMEZONE);
  let target;
  try {
    target = await decideCalorieTarget(
      buildCalorieTargetInput({
        sex: body.sex,
        age: body.age,
        height_cm: body.height_cm,
        weight_kg: body.weight_kg,
        target_weight_kg: body.target_weight_kg,
        activity_level: body.activity_level,
        goal_days: daysUntilMonthsLater(today, body.goal_months),
      }),
    );
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    console.error('onboarding: calorie target failed', error);
    return errorJson('UPSTREAM_UNAVAILABLE', 503);
  }

  try {
    await sql.transaction([
      sql`
        insert into kkilog.profiles
          (user_id, nickname, sex, birth_year, height_cm, target_weight_kg, activity_level, goal_months, timezone)
        values
          (${userId}, ${body.nickname}, ${body.sex}, ${birthYearFromAge(today, body.age)}, ${body.height_cm},
           ${body.target_weight_kg}, ${body.activity_level}, ${body.goal_months}, ${DEFAULT_TIMEZONE})`,
      sql`
        insert into kkilog.weight_logs (user_id, client_request_id, local_date, weight_kg, source)
        values (${userId}, ${crypto.randomUUID()}, ${today}, ${body.weight_kg}, 'onboarding')`,
      sql`
        insert into kkilog.calorie_targets
          (user_id, kcal, llm_kcal, maintenance_kcal, clamped, reason, inputs, model_id, prompt_version, raw_response)
        values
          (${userId}, ${target.kcal}, ${target.llmKcal}, ${target.maintenanceKcal}, ${target.clamped}, ${target.reason},
           ${JSON.stringify(target.inputs)}::jsonb, ${target.modelId}, ${target.promptVersion},
           ${JSON.stringify(target.raw)}::jsonb)`,
    ]);
  } catch (error) {
    if (isProfileConflict(error)) return errorJson('PROFILE_EXISTS', 409);
    throw error;
  }

  return privateJson<OnboardingResponse>({
    calorie_target: {
      kcal: target.kcal,
      clamped: target.clamped,
      expected_days: target.expectedDays,
      reason: target.reason,
    },
  });
}
