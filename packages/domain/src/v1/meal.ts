import { MEAL_ITEM_MAX_KCAL, MEAL_ITEM_MAX_MACRO_G, MEAL_MAX_ITEMS, MEAL_MAX_KCAL } from './params';

export type MealItemInput = {
  name: string;
  quantity: number;
  unit: string;
  estimated_grams: number;
  kcal: number;
  carb_g: number;
  protein_g: number;
  fat_g: number;
  confidence: 'high' | 'medium' | 'low';
};

export type MealTotals = { kcal: number; carb_g: number; protein_g: number; fat_g: number };

export type MealRejectReason = 'TOO_MANY_ITEMS' | 'INVALID_VALUE' | 'ITEM_ABOVE_MAX' | 'TOTAL_ABOVE_MAX';

export type NormalizedMeal =
  | { ok: true; items: MealItemInput[]; totals: MealTotals }
  | { ok: false; reason: MealRejectReason };

const round1 = (value: number) => Math.round(value * 10) / 10;

// LLM이 준 음식별 추정치를 정리하고 합계를 계산한다(spec 6). LLM 합계는 받지 않는다.
// kcal은 정수, 탄단지는 소수 첫째 자리로 반올림하고, 합계는 반올림한 항목 값의 합이다.
// 음수·NaN·상한 초과가 하나라도 있으면 분석 전체를 거부한다(부분 저장 안 함).
export function normalizeMeal(items: readonly MealItemInput[]): NormalizedMeal {
  if (items.length > MEAL_MAX_ITEMS) return { ok: false, reason: 'TOO_MANY_ITEMS' };

  const normalized: MealItemInput[] = [];
  for (const item of items) {
    const values = [item.quantity, item.estimated_grams, item.kcal, item.carb_g, item.protein_g, item.fat_g];
    if (values.some((v) => !Number.isFinite(v) || v < 0)) return { ok: false, reason: 'INVALID_VALUE' };

    const next: MealItemInput = {
      ...item,
      name: item.name.trim(),
      unit: item.unit.trim(),
      estimated_grams: Math.round(item.estimated_grams),
      kcal: Math.round(item.kcal),
      carb_g: round1(item.carb_g),
      protein_g: round1(item.protein_g),
      fat_g: round1(item.fat_g),
    };
    if (
      next.kcal > MEAL_ITEM_MAX_KCAL ||
      next.carb_g > MEAL_ITEM_MAX_MACRO_G ||
      next.protein_g > MEAL_ITEM_MAX_MACRO_G ||
      next.fat_g > MEAL_ITEM_MAX_MACRO_G
    ) {
      return { ok: false, reason: 'ITEM_ABOVE_MAX' };
    }
    normalized.push(next);
  }

  const totals = sumMeal(normalized);
  if (totals.kcal > MEAL_MAX_KCAL) return { ok: false, reason: 'TOTAL_ABOVE_MAX' };
  return { ok: true, items: normalized, totals };
}

// 여러 항목(또는 여러 끼니 합계)을 더한다. 탄단지는 더한 뒤 소수 첫째 자리로 맞춘다.
export function sumMeal(parts: readonly MealTotals[]): MealTotals {
  const sum = parts.reduce(
    (acc, p) => ({
      kcal: acc.kcal + p.kcal,
      carb_g: acc.carb_g + p.carb_g,
      protein_g: acc.protein_g + p.protein_g,
      fat_g: acc.fat_g + p.fat_g,
    }),
    { kcal: 0, carb_g: 0, protein_g: 0, fat_g: 0 },
  );
  return { kcal: sum.kcal, carb_g: round1(sum.carb_g), protein_g: round1(sum.protein_g), fat_g: round1(sum.fat_g) };
}
