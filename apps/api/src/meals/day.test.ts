import type { Meal } from '@kkilog/contracts';
import { describe, expect, it } from 'vitest';
import { dayTotals } from './day';

const base = {
  meal_type: 'lunch',
  local_date: '2026-10-20',
  eaten_at: '2026-10-20T03:00:00.000Z',
  input_text: 'x',
  photo_urls: [] as string[],
  photo_url: null,
} as const;

const ok = (id: string, kcal: number, carb: number): Meal => ({
  ...base,
  id,
  analysis: {
    status: 'ok',
    items: [],
    totals: { kcal, carb_g: carb, protein_g: 10, fat_g: 5 },
    notes: null,
    correction_text: null,
    created_at: '2026-10-20T03:00:01.000Z',
  },
});

describe('dayTotals', () => {
  it('ok 분석만 더하고 실패·분석 전 끼니는 뺀다', () => {
    const meals: Meal[] = [
      ok('00000000-0000-4000-8000-000000000001', 500, 60.15),
      ok('00000000-0000-4000-8000-000000000002', 700, 80.1),
      {
        ...base,
        id: '00000000-0000-4000-8000-000000000003',
        analysis: { status: 'failed', error: 'GEMINI_UNAVAILABLE', correction_text: null, created_at: '2026-10-20T03:00:01.000Z' },
      },
      { ...base, id: '00000000-0000-4000-8000-000000000004', analysis: null },
    ];
    expect(dayTotals(meals)).toEqual({ kcal: 1200, carb_g: 140.3, protein_g: 20, fat_g: 10 });
  });

  it('끼니가 없으면 0', () => {
    expect(dayTotals([])).toEqual({ kcal: 0, carb_g: 0, protein_g: 0, fat_g: 0 });
  });
});
