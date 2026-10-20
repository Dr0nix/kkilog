import { z } from 'zod';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'late_night', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  late_night: '야식',
  snack: '간식',
};

export const MEAL_TEXT_MAX_LENGTH = 500;
export const CORRECTION_TEXT_MAX_LENGTH = 200;

// POST /api/meals 는 multipart/form-data. 사진은 앱에서 긴 변 1024px JPEG로 줄여서 보낸다(spec 3).
export const CREATE_MEAL_FIELDS = {
  mealType: 'meal_type',
  clientRequestId: 'client_request_id',
  text: 'text', // 선택
  photo: 'photo', // 선택, image/jpeg. 같은 이름으로 여러 번(최대 MEAL_PHOTOS_MAX장), 보낸 순서가 사진 순서
  eatenAt: 'eaten_at', // 선택, 먹은 시각(ISO 8601). 없으면 지금. 그날(local_date)도 이 시각으로 정한다
} as const;

// 한 끼 사진 장수와 크기(spec 2.4). 전체 한도는 Vercel 함수 요청 본문 한도(4.5MB)보다 작게 잡는다.
export const MEAL_PHOTOS_MAX = 5;
export const MEAL_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const MEAL_PHOTOS_MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export const CreateMealFieldsSchema = z.object({
  meal_type: z.enum(MEAL_TYPES),
  client_request_id: z.uuid(),
  // 빈 문자열은 없는 것으로 본다.
  text: z
    .string()
    .trim()
    .max(MEAL_TEXT_MAX_LENGTH)
    .transform((value) => (value === '' ? null : value))
    .nullable(),
  // 허용 범위(미래 금지, 며칠 전까지)는 서버가 domain에서 검사한다.
  eaten_at: z.iso.datetime({ offset: true }).nullable(),
});

// POST /api/meals/:id/analyze — 재시도(보정 없음) 또는 한 줄 보정으로 재분석
export const AnalyzeMealRequestSchema = z.object({
  correction_text: z.string().trim().min(1).max(CORRECTION_TEXT_MAX_LENGTH).optional(),
});
export type AnalyzeMealRequest = z.input<typeof AnalyzeMealRequestSchema>;

export const MealItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  estimated_grams: z.number(),
  kcal: z.number(),
  carb_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type MealItem = z.infer<typeof MealItemSchema>;

export const MealTotalsSchema = z.object({
  kcal: z.number(),
  carb_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
});
export type MealTotals = z.infer<typeof MealTotalsSchema>;

// 분석 실패 사유. 앱은 사유와 상관없이 [재시도]를 보여준다.
export const ANALYSIS_ERRORS = [
  'GEMINI_UNAVAILABLE',
  'INVALID_OUTPUT',
  'TOO_MANY_ITEMS',
  'INVALID_VALUE',
  'ITEM_ABOVE_MAX',
  'TOTAL_ABOVE_MAX',
] as const;
export type AnalysisError = (typeof ANALYSIS_ERRORS)[number];

export const MealAnalysisSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    items: z.array(MealItemSchema),
    totals: MealTotalsSchema,
    notes: z.string().nullable(),
    correction_text: z.string().nullable(),
    created_at: z.string(),
  }),
  z.object({
    status: z.literal('failed'),
    error: z.enum(ANALYSIS_ERRORS),
    correction_text: z.string().nullable(),
    created_at: z.string(),
  }),
]);
export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

export const MealSchema = z.object({
  id: z.uuid(),
  meal_type: z.enum(MEAL_TYPES),
  local_date: z.string(),
  eaten_at: z.string(),
  input_text: z.string().nullable(),
  // 짧게 유효한 서명 URL(spec 5). 사진 순서대로. 사진이 없으면 빈 배열
  photo_urls: z.array(z.string()),
  // 첫(대표) 사진 = photo_urls[0]. 사진이 없으면 null. 사진 1장만 알던 예전 앱을 위해 남겨 둔다
  photo_url: z.string().nullable(),
  // 현재 분석 = 가장 최근 ok 분석, 없으면 가장 최근 분석(실패), 분석이 아직 없으면 null
  analysis: MealAnalysisSchema.nullable(),
});
export type Meal = z.infer<typeof MealSchema>;

// GET /api/meals/:id
export const MealResponseSchema = z.object({ meal: MealSchema });
export type MealResponse = z.infer<typeof MealResponseSchema>;

// POST /api/meals, POST /api/meals/:id/analyze
// attempt: 이번 요청에서 한 분석 결과. 재분석이 실패해도 meal.analysis는 이전 ok 분석을 유지한다.
// 같은 client_request_id 재요청이면 새로 분석하지 않으므로 attempt는 null.
export const MealMutationResponseSchema = z.object({
  meal: MealSchema,
  attempt: z
    .discriminatedUnion('status', [
      z.object({ status: z.literal('ok') }),
      z.object({ status: z.literal('failed'), error: z.enum(ANALYSIS_ERRORS) }),
    ])
    .nullable(),
});
export type MealMutationResponse = z.infer<typeof MealMutationResponseSchema>;

// POST /api/meals/:id/advice — 현재 분석 기준 영양 조언(spec 6.2). 이미 있으면 저장된 것을 돌려준다.
export const MealAdviceSchema = z.object({
  text: z.string(),
  // 조언을 만든 분석의 created_at(= meal.analysis.created_at). 앱이 어떤 분석의 조언인지 맞춰 볼 때 쓴다.
  analysis_created_at: z.string(),
  created_at: z.string(),
});
export type MealAdvice = z.infer<typeof MealAdviceSchema>;

export const MealAdviceResponseSchema = z.object({ advice: MealAdviceSchema });
export type MealAdviceResponse = z.infer<typeof MealAdviceResponseSchema>;
