import 'server-only';
import type { MealAdvice } from '@kkilog/contracts';
import type { DailyTarget, MealItemInput } from '@kkilog/domain';
import {
  type AdviceMealSource,
  MEAL_ADVICE_PROMPT,
  MEAL_ADVICE_PROMPT_VERSION,
  buildMealAdviceInput,
  mealAdviceResponseJsonSchema,
  parseMealAdviceOutput,
} from '../llm/meal-advice';
import { type MealEntryRow, toIso } from '../meals/view';
import { db } from './db';
import { GeminiError, generateJson } from './gemini';
import { profileTimezone } from './meals';
import { loadPrompt } from './prompts';

type Numeric = string | number;

type OkAnalysisRow = {
  id: string;
  items: MealItemInput[];
  kcal: number;
  carb_g: Numeric;
  protein_g: Numeric;
  fat_g: Numeric;
  created_at: Date | string;
};

const totalsOf = (row: { kcal: number; carb_g: Numeric; protein_g: Numeric; fat_g: Numeric }) => ({
  kcal: Number(row.kcal),
  carb_g: Number(row.carb_g),
  protein_g: Number(row.protein_g),
  fat_g: Number(row.fat_g),
});

const nullableNumber = (value: Numeric | null) => (value === null ? null : Number(value));

// 현재 분석 = 가장 최근 ok 분석(spec 5). 조언은 이 분석에 붙는다.
async function currentOkAnalysis(entryId: string): Promise<OkAnalysisRow | null> {
  const rows = await db()`
    select id, items, kcal, carb_g, protein_g, fat_g, created_at from kkilog.meal_analyses
    where entry_id = ${entryId} and status = 'ok' order by created_at desc limit 1`;
  return (rows[0] as OkAnalysisRow | undefined) ?? null;
}

async function savedAdvice(analysisId: string): Promise<{ advice: string; created_at: Date | string } | null> {
  const rows = await db()`select advice, created_at from kkilog.meal_advice where analysis_id = ${analysisId}`;
  return (rows[0] as { advice: string; created_at: Date | string } | undefined) ?? null;
}

// 같은 날 이 끼니보다 먼저 먹은 끼니들(각자의 현재 ok 분석 합계). ok 분석이 없는 끼니는 뺀다(spec 5).
async function earlierMeals(userId: string, entry: MealEntryRow): Promise<AdviceMealSource[]> {
  const rows = await db()`
    select e.meal_type, e.eaten_at, a.kcal, a.carb_g, a.protein_g, a.fat_g
    from kkilog.meal_entries e
    join lateral (
      select kcal, carb_g, protein_g, fat_g from kkilog.meal_analyses
      where entry_id = e.id and status = 'ok' order by created_at desc limit 1
    ) a on true
    where e.user_id = ${userId} and e.local_date = ${entry.local_date} and e.deleted_at is null
      and e.id <> ${entry.id} and e.eaten_at < ${toIso(entry.eaten_at)}
    order by e.eaten_at`;
  return rows.map((row) => ({
    mealType: row.meal_type as AdviceMealSource['mealType'],
    eatenAt: new Date(row.eaten_at as Date | string),
    totals: totalsOf(row as { kcal: number; carb_g: Numeric; protein_g: Numeric; fat_g: Numeric }),
  }));
}

// 현재 목표 = 가장 최근 calorie_targets 행(spec 5). 온보딩에서 항상 만들어진다.
async function currentTarget(userId: string): Promise<DailyTarget> {
  const rows = await db()`
    select kcal, carb_g, protein_g, fat_g from kkilog.calorie_targets
    where user_id = ${userId} order by created_at desc limit 1`;
  const row = rows[0];
  if (!row) throw new Error('calorie target not found');
  return {
    kcal: Number(row.kcal),
    carb_g: nullableNumber(row.carb_g as Numeric | null),
    protein_g: nullableNumber(row.protein_g as Numeric | null),
    fat_g: nullableNumber(row.fat_g as Numeric | null),
  };
}

export type AdviceOutcome = { status: 'ok'; advice: MealAdvice } | { status: 'no_analysis' };

// 현재 분석 기준 영양 조언(spec 6.2). 저장된 게 있으면 Gemini를 부르지 않는다.
// Gemini 실패·응답 이상은 GeminiError로 던지고 저장하지 않는다(호출 측이 503).
// 맥락(오늘 다른 끼니·목표)은 이 호출에만 넣는다(CLAUDE.md).
export async function getOrCreateAdvice(userId: string, entry: MealEntryRow): Promise<AdviceOutcome> {
  const analysis = await currentOkAnalysis(entry.id);
  if (!analysis) return { status: 'no_analysis' };

  const toAdvice = (row: { advice: string; created_at: Date | string }): AdviceOutcome => ({
    status: 'ok',
    advice: { text: row.advice, analysis_created_at: toIso(analysis.created_at), created_at: toIso(row.created_at) },
  });

  const saved = await savedAdvice(analysis.id);
  if (saved) return toAdvice(saved);

  const [earlier, target, timeZone] = await Promise.all([
    earlierMeals(userId, entry),
    currentTarget(userId),
    profileTimezone(userId),
  ]);
  const input = buildMealAdviceInput({
    thisMeal: {
      mealType: entry.meal_type,
      eatenAt: new Date(entry.eaten_at),
      totals: totalsOf(analysis),
      items: analysis.items,
    },
    earlierMeals: earlier,
    target,
    timeZone: timeZone ?? 'Asia/Seoul',
  });

  const result = await generateJson({
    systemInstruction: await loadPrompt(MEAL_ADVICE_PROMPT.name, MEAL_ADVICE_PROMPT.version),
    input,
    responseJsonSchema: mealAdviceResponseJsonSchema,
  });
  const output = parseMealAdviceOutput(result.text);
  if (!output) throw new GeminiError(`invalid meal advice output: ${result.text.slice(0, 200)}`);

  // 동시에 두 요청이 만들었으면 먼저 저장된 것을 쓴다(분석당 1건, unique).
  const inserted = await db()`
    insert into kkilog.meal_advice (analysis_id, advice, inputs, model_id, prompt_version, raw_response)
    values (${analysis.id}, ${output.advice}, ${JSON.stringify(input)}::jsonb, ${result.model},
            ${MEAL_ADVICE_PROMPT_VERSION}, ${JSON.stringify(result.raw)}::jsonb)
    on conflict (analysis_id) do nothing
    returning advice, created_at`;
  const row = (inserted[0] as { advice: string; created_at: Date | string } | undefined) ?? (await savedAdvice(analysis.id));
  if (!row) throw new Error('meal advice not saved');
  return toAdvice(row);
}
