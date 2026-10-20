import { describe, expect, it } from 'vitest';
import { type MealAnalysisRow, type MealEntryRow, pickCurrentAnalysis, toMeal } from './view';

const entry: MealEntryRow = {
  id: '6c3a1f0e-8f9d-4b1a-9c2d-3e4f5a6b7c8d',
  meal_type: 'lunch',
  local_date: '2026-10-20',
  eaten_at: new Date('2026-10-20T03:10:00Z'),
  input_text: '김밥 한 줄',
  photo_path: null,
};

const ok = (at: string, kcal: number): MealAnalysisRow => ({
  status: 'ok',
  items: [{ name: '김밥', quantity: 1, unit: '줄', estimated_grams: 230, kcal, carb_g: 60, protein_g: 10, fat_g: 8, confidence: 'high' }],
  kcal,
  carb_g: '60.0', // numeric은 문자열로 온다
  protein_g: '10.0',
  fat_g: '8.0',
  notes: '일반 김밥 1줄',
  correction_text: null,
  error: null,
  created_at: at,
});
const failed = (at: string, error = 'GEMINI_UNAVAILABLE'): MealAnalysisRow => ({
  status: 'failed',
  items: null,
  kcal: null,
  carb_g: null,
  protein_g: null,
  fat_g: null,
  notes: null,
  correction_text: '반 줄만',
  error,
  created_at: at,
});

describe('pickCurrentAnalysis', () => {
  it('가장 최근 ok를 고른다(뒤에 실패한 재분석이 있어도)', () => {
    const rows = [failed('2026-10-20T03:12:00Z'), ok('2026-10-20T03:11:00Z', 420), ok('2026-10-20T03:10:00Z', 500)];
    expect(pickCurrentAnalysis(rows)).toBe(rows[1]);
  });

  it('ok가 없으면 가장 최근 실패, 분석이 없으면 null', () => {
    const rows = [failed('2026-10-20T03:12:00Z'), failed('2026-10-20T03:11:00Z')];
    expect(pickCurrentAnalysis(rows)).toBe(rows[0]);
    expect(pickCurrentAnalysis([])).toBeNull();
  });
});

describe('toMeal', () => {
  it('ok 분석: 합계는 숫자로, 시각은 ISO로', () => {
    expect(toMeal(entry, [ok('2026-10-20T03:11:00Z', 420)], 'https://signed.example/photo')).toEqual({
      id: entry.id,
      meal_type: 'lunch',
      local_date: '2026-10-20',
      eaten_at: '2026-10-20T03:10:00.000Z',
      input_text: '김밥 한 줄',
      photo_url: 'https://signed.example/photo',
      analysis: {
        status: 'ok',
        items: ok('', 420).items,
        totals: { kcal: 420, carb_g: 60, protein_g: 10, fat_g: 8 },
        notes: '일반 김밥 1줄',
        correction_text: null,
        created_at: '2026-10-20T03:11:00.000Z',
      },
    });
  });

  it('실패 분석: 사유를 그대로, 모르는 사유는 INVALID_OUTPUT', () => {
    expect(toMeal(entry, [failed('2026-10-20T03:12:00Z', 'TOTAL_ABOVE_MAX')], null).analysis).toEqual({
      status: 'failed',
      error: 'TOTAL_ABOVE_MAX',
      correction_text: '반 줄만',
      created_at: '2026-10-20T03:12:00.000Z',
    });
    expect(toMeal(entry, [failed('2026-10-20T03:12:00Z', 'SOMETHING_NEW')], null).analysis).toMatchObject({
      error: 'INVALID_OUTPUT',
    });
  });

  it('분석 전이면 analysis는 null', () => {
    expect(toMeal(entry, [], null).analysis).toBeNull();
  });
});
