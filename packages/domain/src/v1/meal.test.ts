import { describe, expect, it } from 'vitest';
import { type MealItemInput, normalizeMeal, sumMeal } from './meal';
import { MEAL_ITEM_MAX_KCAL, MEAL_ITEM_MAX_MACRO_G, MEAL_MAX_ITEMS, MEAL_MAX_KCAL } from './params';

const egg: MealItemInput = {
  name: ' 삶은 계란 ',
  quantity: 3,
  unit: '개',
  estimated_grams: 150.4,
  kcal: 233.6,
  carb_g: 1.84,
  protein_g: 18.86,
  fat_g: 15.94,
  confidence: 'high',
};
const rice: MealItemInput = {
  name: '흰쌀밥',
  quantity: 1,
  unit: '공기',
  estimated_grams: 210,
  kcal: 313,
  carb_g: 68.25,
  protein_g: 5.65,
  fat_g: 0.55,
  confidence: 'medium',
};

describe('normalizeMeal', () => {
  it('반올림하고 합계는 반올림한 항목 값의 합이다', () => {
    const result = normalizeMeal([egg, rice]);
    expect(result).toEqual({
      ok: true,
      items: [
        { ...egg, name: '삶은 계란', estimated_grams: 150, kcal: 234, carb_g: 1.8, protein_g: 18.9, fat_g: 15.9 },
        { ...rice, kcal: 313, carb_g: 68.3, protein_g: 5.7, fat_g: 0.6 },
      ],
      totals: { kcal: 547, carb_g: 70.1, protein_g: 24.6, fat_g: 16.5 },
    });
  });

  it('항목이 없으면 합계 0', () => {
    expect(normalizeMeal([])).toEqual({ ok: true, items: [], totals: { kcal: 0, carb_g: 0, protein_g: 0, fat_g: 0 } });
  });

  it.each([
    ['kcal 음수', { kcal: -1 }],
    ['탄수화물 음수', { carb_g: -0.1 }],
    ['수량 음수', { quantity: -1 }],
    ['NaN', { protein_g: Number.NaN }],
    ['무한대', { fat_g: Number.POSITIVE_INFINITY }],
  ])('%s → INVALID_VALUE', (_name, patch) => {
    expect(normalizeMeal([{ ...egg, ...patch }])).toEqual({ ok: false, reason: 'INVALID_VALUE' });
  });

  it('항목 상한은 포함, 넘으면 ITEM_ABOVE_MAX', () => {
    expect(normalizeMeal([{ ...egg, kcal: MEAL_ITEM_MAX_KCAL }]).ok).toBe(true);
    expect(normalizeMeal([{ ...egg, kcal: MEAL_ITEM_MAX_KCAL + 1 }])).toEqual({ ok: false, reason: 'ITEM_ABOVE_MAX' });
    expect(normalizeMeal([{ ...egg, fat_g: MEAL_ITEM_MAX_MACRO_G + 0.1 }])).toEqual({
      ok: false,
      reason: 'ITEM_ABOVE_MAX',
    });
  });

  it('합계 상한을 넘으면 TOTAL_ABOVE_MAX', () => {
    const big = { ...egg, kcal: MEAL_ITEM_MAX_KCAL };
    const count = Math.floor(MEAL_MAX_KCAL / MEAL_ITEM_MAX_KCAL) + 1;
    expect(normalizeMeal(Array.from({ length: count }, () => big))).toEqual({ ok: false, reason: 'TOTAL_ABOVE_MAX' });
  });

  it('항목 수 상한을 넘으면 TOO_MANY_ITEMS', () => {
    const small = { ...egg, kcal: 1 };
    expect(normalizeMeal(Array.from({ length: MEAL_MAX_ITEMS }, () => small)).ok).toBe(true);
    expect(normalizeMeal(Array.from({ length: MEAL_MAX_ITEMS + 1 }, () => small))).toEqual({
      ok: false,
      reason: 'TOO_MANY_ITEMS',
    });
  });
});

describe('sumMeal', () => {
  it('부동소수 오차 없이 소수 첫째 자리로 더한다', () => {
    expect(
      sumMeal([
        { kcal: 1, carb_g: 0.1, protein_g: 0.2, fat_g: 0.7 },
        { kcal: 2, carb_g: 0.2, protein_g: 0.1, fat_g: 0.1 },
      ]),
    ).toEqual({ kcal: 3, carb_g: 0.3, protein_g: 0.3, fat_g: 0.8 });
  });
});
