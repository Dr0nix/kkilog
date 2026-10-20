import type { MealMutationResponse } from '@kkilog/contracts';
import { localDate } from '@kkilog/domain';
import { parseCreateMealForm } from '@/src/meals/form';
import { attemptOf } from '@/src/meals/attempt';
import type { MealEntryRow } from '@/src/meals/view';
import { authenticate } from '@/src/server/auth';
import { db } from '@/src/server/db';
import { errorJson, privateJson } from '@/src/server/http';
import { analyzeAndSave, findEntryByRequestId, profileTimezone, toMealResponse } from '@/src/server/meals';
import { deletePhoto, mealPhotoPathname, uploadMealPhoto } from '@/src/server/photos';

// 사진 업로드 + Gemini 분석(재시도 포함)을 기다린다.
export const maxDuration = 60;

// 원본(사진·텍스트)을 먼저 저장하고 분석한다. 분석이 실패해도 원본과 실패 행은 남는다(spec 3).
// 같은 client_request_id면 새로 만들지 않고 기존 끼니를 200으로 돌려준다.
export async function POST(request: Request) {
  const userId = await authenticate(request);
  if (!userId) return errorJson('UNAUTHORIZED', 401);

  const timezone = await profileTimezone(userId);
  if (!timezone) return errorJson('ONBOARDING_REQUIRED', 409);

  const form = await request.formData().catch(() => null);
  const input = form ? parseCreateMealForm(form) : null;
  if (!input) return errorJson('INVALID_REQUEST', 400);

  const existing = await findEntryByRequestId(userId, input.clientRequestId);
  if (existing) return privateJson<MealMutationResponse>({ meal: await toMealResponse(existing), attempt: null });

  const entryId = crypto.randomUUID();
  const photoPath = input.photo ? mealPhotoPathname(userId, entryId) : null;
  const photoBytes = input.photo ? Buffer.from(await input.photo.arrayBuffer()) : null;
  if (photoPath && photoBytes) await uploadMealPhoto(photoPath, new Blob([photoBytes], { type: 'image/jpeg' }));

  const now = new Date();
  const inserted = await db()`
    insert into kkilog.meal_entries (id, user_id, client_request_id, local_date, eaten_at, meal_type, input_text, photo_path)
    values (${entryId}, ${userId}, ${input.clientRequestId}, ${localDate(now, timezone)}, ${now.toISOString()},
            ${input.mealType}, ${input.text}, ${photoPath})
    on conflict (user_id, client_request_id) do nothing
    returning id, meal_type, local_date::text as local_date, eaten_at, input_text, photo_path`;

  const entry = inserted[0] as MealEntryRow | undefined;
  if (!entry) {
    // 같은 요청이 동시에 두 번 들어와 다른 쪽이 먼저 저장했다. 올린 사진은 지우고 그쪽 끼니를 돌려준다.
    if (photoPath) await deletePhoto(photoPath);
    const winner = await findEntryByRequestId(userId, input.clientRequestId);
    if (!winner) throw new Error('meal entry conflict without existing row');
    return privateJson<MealMutationResponse>({ meal: await toMealResponse(winner), attempt: null });
  }

  const result = await analyzeAndSave(entry, null, photoBytes?.toString('base64'));
  return privateJson<MealMutationResponse>({ meal: await toMealResponse(entry), attempt: attemptOf(result) });
}
