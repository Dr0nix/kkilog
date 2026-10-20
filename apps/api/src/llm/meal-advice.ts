import { MEAL_TYPE_LABELS, type MealType } from '@kkilog/contracts';
import { type DailyTarget, type MealItemInput, type MealTotals, localTime, remainingToTarget, sumMeal } from '@kkilog/domain';
import { z } from 'zod';
import { jsonSchemaForGemini, parseJsonWith } from './json';

// 프롬프트 파일: prompts/meal-advice/v1.md. 프롬프트·출력 스키마를 바꾸면 버전을 올린다(기존 파일 수정 금지).
export const MEAL_ADVICE_PROMPT = { name: 'meal-advice', version: 'v1' } as const;
export const MEAL_ADVICE_PROMPT_VERSION = `${MEAL_ADVICE_PROMPT.name}/${MEAL_ADVICE_PROMPT.version}`;

// 프롬프트는 200자 이내를 요구한다. 조금 넘는 건 받아 주고, 크게 벗어나면 응답 이상으로 본다.
export const MealAdviceOutputSchema = z.object({
  advice: z.string().trim().min(1).max(300),
});
export type MealAdviceOutput = z.infer<typeof MealAdviceOutputSchema>;

export const mealAdviceResponseJsonSchema = jsonSchemaForGemini(MealAdviceOutputSchema);

type AdviceMeal = { meal_type: string; eaten_at: string; totals: MealTotals };

// 조언 호출 입력(spec 6.2). 합계·남은 양은 서버가 계산해서 넣는다(LLM에게 계산시키지 않음).
export type MealAdviceLlmInput = {
  this_meal: AdviceMeal & {
    items: Pick<MealItemInput, 'name' | 'quantity' | 'unit' | 'kcal' | 'carb_g' | 'protein_g' | 'fat_g'>[];
  };
  earlier_meals_today: AdviceMeal[];
  today_totals: MealTotals;
  daily_target: DailyTarget;
  remaining: DailyTarget;
};

export type AdviceMealSource = { mealType: MealType; eatenAt: Date; totals: MealTotals };

export function buildMealAdviceInput(args: {
  thisMeal: AdviceMealSource & { items: readonly MealItemInput[] };
  earlierMeals: readonly AdviceMealSource[];
  target: DailyTarget;
  timeZone: string;
}): MealAdviceLlmInput {
  const summary = (meal: AdviceMealSource): AdviceMeal => ({
    meal_type: MEAL_TYPE_LABELS[meal.mealType],
    eaten_at: localTime(meal.eatenAt, args.timeZone),
    totals: meal.totals,
  });
  const todayTotals = sumMeal([...args.earlierMeals.map((m) => m.totals), args.thisMeal.totals]);
  return {
    this_meal: {
      ...summary(args.thisMeal),
      items: args.thisMeal.items.map(({ name, quantity, unit, kcal, carb_g, protein_g, fat_g }) => ({
        name,
        quantity,
        unit,
        kcal,
        carb_g,
        protein_g,
        fat_g,
      })),
    },
    earlier_meals_today: args.earlierMeals.map(summary),
    today_totals: todayTotals,
    daily_target: args.target,
    remaining: remainingToTarget(args.target, todayTotals),
  };
}

export function parseMealAdviceOutput(text: string): MealAdviceOutput | null {
  return parseJsonWith(MealAdviceOutputSchema, text);
}
