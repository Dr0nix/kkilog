import type { RecentSummary } from '@kkilog/domain';
import { describe, expect, it } from 'vitest';
import { buildMealAdviceInput, mealAdviceResponseJsonSchema, parseMealAdviceOutput } from './meal-advice';

// 실제 gemini-3.5-flash-lite 응답(prompts/meal-advice/v2.md)에서 가져온 fixture
const FIXTURES = {
  pattern:
    '{ "advice": "오늘 점심까지 단백질이 많이 부족하네요. 저녁에는 닭가슴살이나 두부를 곁들여 단백질을 보충해 보세요. 최근 7일 중 5일 단백질이 부족했어요." }',
  lateNight:
    '{"advice":"야식으로 라면을 드셨군요. 오늘은 이미 늦은 시간이니 이만 식사를 마무리하고, 단백질이 크게 부족한 상태니 내일은 닭가슴살이나 두부 등으로 단백질을 더 챙겨보세요. 최근 7일 중 4일 야식을 드셨어요."}',
};

const recent: RecentSummary = {
  days: 7,
  loggedDays: 6,
  average: { kcal: 1780, carb_g: 240, protein_g: 70, fat_g: 55 },
  averageTargetKcal: 1850,
  averageVsTargetKcal: -70,
  overTargetDays: 1,
  proteinShortDays: 5,
  lateNightDays: 0,
};

const weight = {
  trend_kg: 77.4,
  target_weight_kg: 70,
  remaining_kg: 7.4,
  slope_kg_per_week: -0.48,
  goal_status: 'on_track' as const,
  eta_date: '2027-02-28',
};

// v1 응답(형식은 v2와 같다)
const V1_FIXTURES = {
  over: '{"advice": "오늘 목표보다 520kcal 더 드셨어요. 맛있는 저녁을 즐기셨으니 남은 하루는 편안하게 쉬시고, 내일 다시 가벼운 식단으로 균형을 맞춰가면 돼요."}',
  pretty: '{\n  "advice": "오늘 단백질이 많이 부족한 편이에요. 저녁 식사에는 닭가슴살이나 소고기 구이를 곁들여서 단백질을 든든하게 채워보세요!"\n}',
};

describe('parseMealAdviceOutput', () => {
  it.each(Object.entries(FIXTURES))('실제 응답(%s)을 읽는다', (_name, text) => {
    expect(parseMealAdviceOutput(text)?.advice).toMatch(/최근 7일 중 \d일/);
  });

  it.each(Object.entries(V1_FIXTURES))('v1 응답(%s)도 같은 형식', (_name, text) => {
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
      recent,
      weight,
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
      recent,
      weight,
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

  it('최근 기록 요약과 체중 추세를 snake_case로 넣는다(v2)', () => {
    const input = buildMealAdviceInput({
      thisMeal: lunch,
      earlierMeals: [],
      target: { kcal: 1850, carb_g: 208.1, protein_g: 138.8, fat_g: 51.4 },
      timeZone: 'Asia/Seoul',
      recent,
      weight: null,
    });
    expect(input.recent_days).toEqual({
      days: 7,
      logged_days: 6,
      average: recent.average,
      average_target_kcal: 1850,
      average_vs_target_kcal: -70,
      over_target_days: 1,
      protein_short_days: 5,
      late_night_days: 0,
    });
    expect(input.weight).toBeNull();
  });

  it('덧붙일 최근 흐름은 서버가 고른다: 오늘도 단백질이 부족하고 최근에도 반복됐으면 그 반복', () => {
    const input = buildMealAdviceInput({
      thisMeal: lunch,
      earlierMeals: [breakfast],
      target: { kcal: 1850, carb_g: 208.1, protein_g: 138.8, fat_g: 51.4 },
      timeZone: 'Asia/Seoul',
      recent,
      weight,
    });
    expect(input.recent_highlight).toEqual({ kind: 'protein_short_repeat', days: 5 });
  });

  it('반복이 없으면 순항 격려(예상일 포함), 체중 기록도 없으면 null', () => {
    const quiet = { ...recent, proteinShortDays: 0 };
    const args = {
      thisMeal: lunch,
      earlierMeals: [],
      target: { kcal: 1850, carb_g: 208.1, protein_g: 138.8, fat_g: 51.4 },
      timeZone: 'Asia/Seoul',
      recent: quiet,
    };
    expect(buildMealAdviceInput({ ...args, weight }).recent_highlight).toEqual({ kind: 'on_track', eta_date: '2027-02-28' });
    expect(buildMealAdviceInput({ ...args, weight: null }).recent_highlight).toBeNull();
  });
});
