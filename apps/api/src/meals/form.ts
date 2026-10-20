import { CREATE_MEAL_FIELDS, CreateMealFieldsSchema, type MealType } from '@kkilog/contracts';

// 앱이 긴 변 1024px JPEG(품질 0.7, 보통 ~200KB)로 줄여 보낸다. Vercel 함수 요청 본문 한도(4.5MB)보다 작게 잡는다.
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export type CreateMealInput = {
  mealType: MealType;
  clientRequestId: string;
  text: string | null;
  photo: File | null;
};

// POST /api/meals multipart 본문을 검증한다. 사진과 텍스트 중 하나는 있어야 한다.
export function parseCreateMealForm(form: FormData): CreateMealInput | null {
  const text = form.get(CREATE_MEAL_FIELDS.text);
  const fields = CreateMealFieldsSchema.safeParse({
    meal_type: form.get(CREATE_MEAL_FIELDS.mealType),
    client_request_id: form.get(CREATE_MEAL_FIELDS.clientRequestId),
    text: typeof text === 'string' ? text : null,
  });
  if (!fields.success) return null;

  const rawPhoto = form.get(CREATE_MEAL_FIELDS.photo);
  let photo: File | null = null;
  if (rawPhoto !== null) {
    if (typeof rawPhoto === 'string') return null;
    if (rawPhoto.type !== 'image/jpeg' || rawPhoto.size === 0 || rawPhoto.size > MAX_PHOTO_BYTES) return null;
    photo = rawPhoto;
  }

  if (!photo && !fields.data.text) return null;
  return {
    mealType: fields.data.meal_type,
    clientRequestId: fields.data.client_request_id,
    text: fields.data.text,
    photo,
  };
}
