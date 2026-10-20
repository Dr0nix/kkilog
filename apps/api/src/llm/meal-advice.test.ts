import { describe, expect, it } from 'vitest';
import { buildMealAdviceInput, mealAdviceResponseJsonSchema, parseMealAdviceOutput } from './meal-advice';

// 실제 gemini-3.5-flash-lite 응답(prompts/meal-advice/v1.md)에서 가져온 fixture
const FIXTURES = {
  over: '{"advice": "오늘 목표보다 520kcal 더 드셨어요. 맛있는 저녁을 즐기셨으니 남은 하루는 편안하게 쉬시고, 내일 다시 가벼운 식단으로 균형을 맞춰가면 돼요."}',
  pretty: '{\n  "advice": "오늘 단백질이 많이 부족한 편이에요. 저녁 식사에는 닭가슴살이나 소고기 구이를 곁들여서 단백질을 든든하게 채워보세요!"\n}',
};

describe('parseMealAdviceOutput', () => {
  it.each(Object.entries(FIXTURES))('실제 응답(%s)을 읽는다', (_name, text) => {
    expect(parseMealAdviceOutput(text)?.advice).toMatch(/^오늘 /);
  });

  it.each([
    ['JSON이 아님', 'not json'],
    ['필드 누락', '{}'],
    ['빈 문자열', '{"advice": "  "}'],
    ['너무 김', JSON.stringify({ advice: '가'.repeat(301) })],
  ])('%s → null', (_name, text) => {
    expect(parseMealAdviceOutput(text)).toBeNull();
  });
});

describe('mealAdviceResponseJsonSchema', () => {
  it('$schema 키 없이 advice를 요구한다', () => {
    expect(mealAdviceResponseJsonSchema).not.toHaveProperty('$schema');
    expect(mealAdviceResponseJsonSchema.required).toEqual(['advice']);
  });
});

describe('buildMealAdviceInput', () => {
  const lunch = {
    mealType: 'lunch' as const,
    eatenAt: new Date('2026-10-20T03:30:00Z'),
    totals: { kcal: 720, carb_g: 110.5, protein_g: 22.3, fat_g: 19.8 },
    items: [
      {
        name: '돌솥비빔밥',
        quantity: 1,
        unit: '그릇',
        estimated_grams: 500,
        kcal: 720,
        carb_g: 110.5,
        protein_g: 22.3,
        fat_g: 19.8,
        confidence: 'high' as const,
      },
    ],
  };
  const breakfast = {
    mealType: 'breakfast' as const,
    eatenAt: new Date('2026-10-19T23:10:00Z'),
    totals: { kcal: 350, carb_g: 45, protein_g: 8, fat_g: 15 },
  };

  it('태그는 한국어, 시각은 타임존 기준, 오늘 합계·남은 양은 서버가 계산한다', () => {
    const input = buildMealAdviceInput({
      thisMeal: lunch,
      earlierMeals: [breakfast],
      target: { kcal: 1850, carb_g: 208.1, protein_g: 138.8, fat_g: 51.4 },
      timeZone: 'Asia/Seoul',
    });
    expect(input.this_meal).toMatchObject({ meal_type: '점심', eaten_at: '12:30' });
    expect(input.earlier_meals_today).toEqual([{ meal_type: '아침', eaten_at: '08:10', totals: breakfast.totals }]);
    expect(input.today_totals).toEqual({ kcal: 1070, carb_g: 155.5, protein_g: 30.3, fat_g: 34.8 });
    expect(input.remaining).toEqual({ kcal: 780, carb_g: 52.6, protein_g: 108.5, fat_g: 16.6 });
  });

  it('음식 항목엔 그램 추정·확신도를 넣지 않는다', () => {
    const input = buildMealAdviceInput({
      thisMeal: lunch,
      earlierMeals: [],
      target: { kcal: 1850, carb_g: null, protein_g: null, fat_g: null },
      timeZone: 'Asia/Seoul',
    });
    expect(input.this_meal.items[0]).toEqual({
      name: '돌솥비빔밥',
      quantity: 1,
      unit: '그릇',
      kcal: 720,
      carb_g: 110.5,
      protein_g: 22.3,
      fat_g: 19.8,
    });
    expect(input.remaining).toEqual({ kcal: 1130, carb_g: null, protein_g: null, fat_g: null });
  });
});
