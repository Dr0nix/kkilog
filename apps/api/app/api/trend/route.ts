import { type TrendResponse, TrendQuerySchema } from '@kkilog/contracts';
import { localDate } from '@kkilog/domain';
import { authenticate } from '@/src/server/auth';
import { db } from '@/src/server/db';
import { errorJson, privateJson } from '@/src/server/http';
import { buildTrend } from '@/src/server/trend';

// 체중 실측 + 추세 + 목표 도달 예상 + 7일 평균 섭취(spec 2.5·7.2).
export async function GET(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const rows = await db()`select target_weight_kg, timezone from kkilog.profiles where user_id = ${userId}`;
  const profile = rows[0] as { target_weight_kg: string | number; timezone: string } | undefined;
  if (!profile) return errorJson('ONBOARDING_REQUIRED', 409);

  const params = new URL(request.url).searchParams;
  const query = TrendQuerySchema.safeParse({ days: params.get('days') ?? undefined });
  if (!query.success) return errorJson('INVALID_REQUEST', 400);

  return privateJson<TrendResponse>(
    await buildTrend({
      userId,
      today: localDate(new Date(), profile.timezone),
      days: query.data.days,
      targetWeightKg: Number(profile.target_weight_kg),
      timeZone: profile.timezone,
    }),
  );
}
