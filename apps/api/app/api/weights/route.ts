import { CreateWeightRequestSchema, type CreateWeightResponse } from '@kkilog/contracts';
import { localDate } from '@kkilog/domain';
import { authenticate } from '@/src/server/auth';
import { errorJson, privateJson } from '@/src/server/http';
import { profileTimezone } from '@/src/server/meals';
import { saveDailyWeight } from '@/src/server/weights';

// 오늘 체중 기록. 같은 client_request_id면 기존 기록을 200으로 돌려준다(spec 3).
// 수정·삭제 API는 두지 않는다(spec 5).
export async function POST(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const timezone = await profileTimezone(userId);
  if (!timezone) return errorJson('ONBOARDING_REQUIRED', 409);

  const parsed = CreateWeightRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorJson('INVALID_REQUEST', 400);

  const weight = await saveDailyWeight({
    userId,
    clientRequestId: parsed.data.client_request_id,
    localDate: localDate(new Date(), timezone),
    weightKg: parsed.data.weight_kg,
  });
  return privateJson<CreateWeightResponse>({ weight });
}
