import { normalizeMeal } from '@kkilog/domain';
import { describe, expect, it } from 'vitest';
import { mealAnalysisResponseJsonSchema, parseMealAnalysisOutput } from './meal-analysis';

// 실제 Gemini 응답(prompts/meal-analysis/v1.md)에서 가져온 fixture
const FIXTURES = {
  // 텍스트 "삶은 계란 3개, 더단백 프로틴음료 1개" (gemini-3.8-flash)
  text: JSON.stringify({
    items: [
      { name: '삶은 계란', quantity: 3, unit: '개', estimated_grams: 150, kcal: 220, carb_g: 1.5, protein_g: 18.5, fat_g: 15, confidence: 'high' },
      { name: '더단백 프로틴음료', quantity: 1, unit: '개', estimated_grams: 250, kcal: 105, carb_g: 7.5, protein_g: 20, fat_g: 0.8, confidence: 'high' },
    ],
    notes: '삶은 계란은 대란 1개당 약 50g 기준이며, 더단백 프로틴음료는 일반적인 시판 250ml 제품 1팩 기준으로 영양성분을 추정했습니다.',
  }),
  // 사진(돌솥비빔밥) + 보정 "밥은 반 공기만 먹었어" (gemini-3.5-flash-lite)
  photoWithCorrection: JSON.stringify({
    items: [
      { name: '돌솥비빔밥 (밥 반 공기)', quantity: 1, unit: '그릇', estimated_grams: 320, kcal: 450, carb_g: 65, protein_g: 14, fat_g: 14, confidence: 'high' },
    ],
    notes: '사진 속 돌솥비빔밥을 바탕으로 보정 요청에 따라 밥은 반 공기(약 100g)와 각종 나물, 계란, 고추장을 포함한 1그릇 분량으로 가정하여 추정했습니다.',
  }),
  // 텍스트 "오늘 기분 좋다" (gemini-3.5-flash-lite)
  notFood: JSON.stringify({ items: [], notes: '음식에 대한 설명이나 사진이 없어 분석할 수 없습니다.' }),
};

describe('parseMealAnalysisOutput + normalizeMeal', () => {
  it('텍스트 분석: 합계는 서버가 항목을 더해 계산한다', () => {
    const output = parseMealAnalysisOutput(FIXTURES.text);
    expect(output?.items).toHaveLength(2);
    const meal = normalizeMeal(output?.items ?? []);
    expect(meal).toMatchObject({ ok: true, totals: { kcal: 325, carb_g: 9, protein_g: 38.5, fat_g: 15.8 } });
  });

  it('사진 + 보정 분석', () => {
    const meal = normalizeMeal(parseMealAnalysisOutput(FIXTURES.photoWithCorrection)?.items ?? []);
    expect(meal).toMatchObject({ ok: true, totals: { kcal: 450 } });
  });

  it('음식이 아니면 빈 항목 + 합계 0 (ok로 저장)', () => {
    const output = parseMealAnalysisOutput(FIXTURES.notFood);
    expect(output).toEqual({ items: [], notes: '음식에 대한 설명이나 사진이 없어 분석할 수 없습니다.' });
    expect(normalizeMeal(output?.items ?? [])).toMatchObject({ ok: true, totals: { kcal: 0 } });
  });

  it('음수 값은 형식은 통과하지만 정규화에서 거부된다', () => {
    const output = parseMealAnalysisOutput(FIXTURES.text.replace('"kcal":220', '"kcal":-220'));
    expect(output).not.toBeNull();
    expect(normalizeMeal(output?.items ?? [])).toEqual({ ok: false, reason: 'INVALID_VALUE' });
  });

  it.each([
    ['JSON이 아님', 'oops'],
    ['items 없음', '{"notes":"x"}'],
    ['confidence 값 틀림', FIXTURES.text.replace('"high"', '"certain"')],
    ['이름 비어 있음', FIXTURES.text.replace('"삶은 계란"', '"  "')],
    ['숫자가 문자열', FIXTURES.text.replace('"kcal":220', '"kcal":"220"')],
  ])('%s → null', (_name, text) => {
    expect(parseMealAnalysisOutput(text)).toBeNull();
  });
});

describe('mealAnalysisResponseJsonSchema', () => {
  it('$schema 키 없이 items·notes를 요구한다', () => {
    expect(mealAnalysisResponseJsonSchema).not.toHaveProperty('$schema');
    expect(mealAnalysisResponseJsonSchema.required).toEqual(['items', 'notes']);
  });
});
