import {
  CREATE_MEAL_FIELDS,
  CreateMealFieldsSchema,
  MEAL_PHOTO_MAX_BYTES,
  MEAL_PHOTOS_MAX,
  MEAL_PHOTOS_MAX_TOTAL_BYTES,
  type MealType,
} from '@kkilog/contracts';

// 앱이 긴 변 1024px JPEG(품질 0.7, 보통 ~200KB)로 줄여 보낸다. 장수·크기 한도는 contracts에 있다.
export type CreateMealInput = {
  mealType: MealType;
  clientRequestId: string;
  text: string | null;
  // 보낸 순서 그대로. 첫 장이 대표 사진
  photos: File[];
};

// POST /api/meals multipart 본문을 검증한다. 사진과 텍스트 중 하나는 있어야 한다.
// 사진은 같은 필드 이름으로 여러 번 온다(최대 MEAL_PHOTOS_MAX장). 사진 1장만 보내는 예전 앱도 그대로 통과한다.
export function parseCreateMealForm(form: FormData): CreateMealInput | null {
  const text = form.get(CREATE_MEAL_FIELDS.text);
  const fields = CreateMealFieldsSchema.safeParse({
    meal_type: form.get(CREATE_MEAL_FIELDS.mealType),
    client_request_id: form.get(CREATE_MEAL_FIELDS.clientRequestId),
    text: typeof text === 'string' ? text : null,
  });
  if (!fields.success) return null;

  const photos: File[] = [];
  for (const raw of form.getAll(CREATE_MEAL_FIELDS.photo)) {
    if (typeof raw === 'string') return null;
    if (raw.type !== 'image/jpeg' || raw.size === 0 || raw.size > MEAL_PHOTO_MAX_BYTES) return null;
    photos.push(raw);
  }
  if (photos.length > MEAL_PHOTOS_MAX) return null;
  if (photos.reduce((sum, photo) => sum + photo.size, 0) > MEAL_PHOTOS_MAX_TOTAL_BYTES) return null;

  if (photos.length === 0 && !fields.data.text) return null;
  return {
    mealType: fields.data.meal_type,
    clientRequestId: fields.data.client_request_id,
    text: fields.data.text,
    photos,
  };
}
