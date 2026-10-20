import { ANALYSIS_ERRORS, type AnalysisError, type Meal, type MealAnalysis, type MealItem, type MealType } from '@kkilog/contracts';

// DB에서 읽은 그대로의 행. numeric은 문자열, 타임스탬프는 Date 또는 문자열로 온다.
export type MealEntryRow = {
  id: string;
  meal_type: MealType;
  local_date: string; // SQL에서 ::text로 읽는다(Date로 바뀌며 타임존이 섞이지 않게)
  eaten_at: Date | string;
  input_text: string | null;
  // 대표(첫) 사진. 사진 목록은 meal_photos가 기준이다(0005)
  photo_path: string | null;
};

export type MealAnalysisRow = {
  status: 'ok' | 'failed';
  items: unknown;
  kcal: number | null;
  carb_g: string | number | null;
  protein_g: string | number | null;
  fat_g: string | number | null;
  notes: string | null;
  correction_text: string | null;
  error: string | null;
  created_at: Date | string;
};

export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAnalysisError(error: string | null): AnalysisError {
  return (ANALYSIS_ERRORS as readonly string[]).includes(error ?? '') ? (error as AnalysisError) : 'INVALID_OUTPUT';
}

export function toMealAnalysis(row: MealAnalysisRow): MealAnalysis {
  const base = { correction_text: row.correction_text, created_at: toIso(row.created_at) };
  if (row.status === 'failed') return { status: 'failed', error: toAnalysisError(row.error), ...base };
  return {
    status: 'ok',
    // DB check 제약이 ok면 items 배열·합계가 있음을 보장한다(0001 meal_analyses_status_fields_chk).
    items: row.items as MealItem[],
    totals: {
      kcal: Number(row.kcal),
      carb_g: Number(row.carb_g),
      protein_g: Number(row.protein_g),
      fat_g: Number(row.fat_g),
    },
    notes: row.notes,
    ...base,
  };
}

// 현재 분석 = 가장 최근 ok, 없으면 가장 최근 분석(spec 5). analyses는 created_at 내림차순.
export function pickCurrentAnalysis(analyses: readonly MealAnalysisRow[]): MealAnalysisRow | null {
  return analyses.find((a) => a.status === 'ok') ?? analyses[0] ?? null;
}

// photoUrls는 사진 순서대로 서명한 URL.
export function toMeal(entry: MealEntryRow, analyses: readonly MealAnalysisRow[], photoUrls: readonly string[]): Meal {
  const current = pickCurrentAnalysis(analyses);
  return {
    id: entry.id,
    meal_type: entry.meal_type,
    local_date: entry.local_date,
    eaten_at: toIso(entry.eaten_at),
    input_text: entry.input_text,
    photo_urls: [...photoUrls],
    photo_url: photoUrls[0] ?? null,
    analysis: current ? toMealAnalysis(current) : null,
  };
}
