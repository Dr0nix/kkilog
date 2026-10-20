import 'server-only';
import type { MealAdvice } from '@kkilog/contracts';
import {
  type DailyTarget,
  INTAKE_AVERAGE_DAYS,
  type MealItemInput,
  type RecentSummary,
  addDays,
  summarizeRecentDays,
} from '@kkilog/domain';
import {
  type AdviceMealSource,
  type AdviceWeight,
  MEAL_ADVICE_PROMPT,
  MEAL_ADVICE_PROMPT_VERSION,
  buildMealAdviceInput,
  mealAdviceResponseJsonSchema,
  parseMealAdviceOutput,
} from '../llm/meal-advice';
import { type MealEntryRow, toIso } from '../meals/view';
import { db } from './db';
import { GeminiError, generateJson } from './gemini';
import { loadPrompt } from './prompts';
import { targetsOn } from './targets';
import { recentMeals, weightProgress } from './trend';

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

// 장기 맥락(spec 6.2, v2): 이 끼니 날짜 전날까지 최근 며칠의 요약과 체중 추세. 숫자·패턴은 전부 서버가 계산한다.
async function longContext(
  userId: string,
  date: string,
): Promise<{ recent: RecentSummary; weight: AdviceWeight | null; timeZone: string }> {
  const rows = await db()`select timezone, target_weight_kg from kkilog.profiles where user_id = ${userId}`;
  const profile = rows[0];
  if (!profile) throw new Error('profile not found');
  const timeZone = profile.timezone as string;
  const targetWeightKg = Number(profile.target_weight_kg);

  const meals = await recentMeals(userId, addDays(date, -INTAKE_AVERAGE_DAYS), addDays(date, -1));
  const [targets, progress] = await Promise.all([
    targetsOn(userId, [...new Set(meals.map((m) => m.date))], timeZone),
    weightProgress(userId, date, targetWeightKg),
  ]);
  const weight =
    progress.trendKg !== null && progress.progress
      ? {
          trend_kg: progress.trendKg,
          target_weight_kg: targetWeightKg,
          remaining_kg: progress.progress.remainingKg,
          slope_kg_per_week: progress.slope,
          goal_status: progress.progress.status,
          eta_date: progress.progress.status === 'on_track' ? progress.progress.etaDate : null,
        }
      : null;
  return { recent: summarizeRecentDays(meals, targets, INTAKE_AVERAGE_DAYS), weight, timeZone };
}

export type AdviceOutcome = { status: 'ok'; advice: MealAdvice } | { status: 'no_analysis' };

// 현재 분석 기준 영양 조언(spec 6.2). 저장된 게 있으면 Gemini를 부르지 않는다.
// Gemini 실패·응답 이상은 GeminiError로 던지고 저장하지 않는다(호출 측이 503).
// 맥락(오늘 다른 끼니·목표·최근 기록·체중 추세)은 이 호출에만 넣는다(CLAUDE.md).
export async function getOrCreateAdvice(userId: string, entry: MealEntryRow): Promise<AdviceOutcome> {
  const analysis = await currentOkAnalysis(entry.id);
  if (!analysis) return { status: 'no_analysis' };

  const toAdvice = (row: { advice: string; created_at: Date | string }): AdviceOutcome => ({
    status: 'ok',
    advice: { text: row.advice, analysis_created_at: toIso(analysis.created_at), created_at: toIso(row.created_at) },
  });

  const saved = await savedAdvice(analysis.id);
  if (saved) return toAdvice(saved);

  const [earlier, target, context] = await Promise.all([
    earlierMeals(userId, entry),
    currentTarget(userId),
    longContext(userId, entry.local_date),
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
    timeZone: context.timeZone,
    recent: context.recent,
    weight: context.weight,
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
