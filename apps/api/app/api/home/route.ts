import { HomeQuerySchema, type HomeResponse } from '@kkilog/contracts';
import { localDate } from '@kkilog/domain';
import { authenticate } from '@/src/server/auth';
import { errorJson, privateJson } from '@/src/server/http';
import { buildHome } from '@/src/server/home';
import { profileTimezone } from '@/src/server/meals';

// 그날 섭취 합계·목표·끼니 목록·체중 기록 여부(spec 2.3). date가 없으면 오늘.
export async function GET(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const timezone = await profileTimezone(userId);
  if (!timezone) return errorJson('ONBOARDING_REQUIRED', 409);

  const params = new URL(request.url).searchParams;
  const query = HomeQuerySchema.safeParse({ date: params.get('date') ?? undefined });
  if (!query.success) return errorJson('INVALID_REQUEST', 400);

  const today = localDate(new Date(), timezone);
  return privateJson<HomeResponse>(
    await buildHome({ userId, date: query.data.date ?? today, today, timeZone: timezone }),
  );
}
