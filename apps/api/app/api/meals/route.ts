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
  const photoPaths = input.photos.map((_, position) => mealPhotoPathname(userId, entryId, position));
  const photoBytes = await Promise.all(
    input.photos.map(async (photo, position) => {
      const bytes = Buffer.from(await photo.arrayBuffer());
      await uploadMealPhoto(mealPhotoPathname(userId, entryId, position), new Blob([bytes], { type: 'image/jpeg' }));
      return bytes;
    }),
  );

  // 끼니와 사진 행을 한 문장으로 넣는다(둘 중 하나만 저장되는 일이 없게). 첫 사진은 대표 사진으로 photo_path에도 둔다.
  const now = new Date();
  const inserted = await db()`
    with entry as (
      insert into kkilog.meal_entries (id, user_id, client_request_id, local_date, eaten_at, meal_type, input_text, photo_path)
      values (${entryId}, ${userId}, ${input.clientRequestId}, ${localDate(now, timezone)}, ${now.toISOString()},
              ${input.mealType}, ${input.text}, ${photoPaths[0] ?? null})
      on conflict (user_id, client_request_id) do nothing
      returning id, meal_type, local_date::text as local_date, eaten_at, input_text, photo_path
    ), photos as (
      insert into kkilog.meal_photos (entry_id, position, path)
      select entry.id, p.ord - 1, p.path from entry, unnest(${photoPaths}::text[]) with ordinality as p(path, ord)
    )
    select * from entry`;

  const entry = inserted[0] as MealEntryRow | undefined;
  if (!entry) {
    // 같은 요청이 동시에 두 번 들어와 다른 쪽이 먼저 저장했다. 올린 사진은 지우고 그쪽 끼니를 돌려준다.
    await Promise.all(photoPaths.map(deletePhoto));
    const winner = await findEntryByRequestId(userId, input.clientRequestId);
    if (!winner) throw new Error('meal entry conflict without existing row');
    return privateJson<MealMutationResponse>({ meal: await toMealResponse(winner), attempt: null });
  }

  const result = await analyzeAndSave(entry, null, photoBytes.map((bytes) => bytes.toString('base64')));
  return privateJson<MealMutationResponse>({ meal: await toMealResponse(entry), attempt: attemptOf(result) });
}
