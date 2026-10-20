import { ACTIVITY_LEVELS, type Sex } from '@kkilog/contracts';
import { z } from 'zod';
import { jsonSchemaForGemini, parseJsonWith } from './json';

// 프롬프트 파일: prompts/calorie-target/v2.md(v1에 탄단지 비율 추가). 프롬프트·출력 스키마를 바꾸면 버전을 올린다(기존 파일 수정 금지).
export const CALORIE_TARGET_PROMPT = { name: 'calorie-target', version: 'v2' } as const;
export const CALORIE_TARGET_PROMPT_VERSION = `${CALORIE_TARGET_PROMPT.name}/${CALORIE_TARGET_PROMPT.version}`;

export const CalorieTargetOutputSchema = z.object({
  maintenance_kcal: z.number().int().positive(),
  // 무리한 목표면 0 이하도 나온다. 그대로 받아서 서버가 하한으로 맞춘다(spec 7.1).
  kcal: z.number().int(),
  // 범위(각각 5~80, 합 100) 검사는 domain(finalizeMacroTarget)이 한다. 여기선 정수인지만 본다.
  carb_pct: z.number().int(),
  protein_pct: z.number().int(),
  fat_pct: z.number().int(),
  reason: z.string().min(1).max(500),
});
export type CalorieTargetOutput = z.infer<typeof CalorieTargetOutputSchema>;

export const calorieTargetResponseJsonSchema = jsonSchemaForGemini(CalorieTargetOutputSchema);

export type CalorieTargetLlmInput = {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  target_weight_kg: number;
  activity_level: number;
  activity_label: string;
  goal_days: number;
};

export function buildCalorieTargetInput(input: Omit<CalorieTargetLlmInput, 'activity_label'>): CalorieTargetLlmInput {
  const activity = ACTIVITY_LEVELS.find((a) => a.level === input.activity_level);
  if (!activity) throw new Error(`unknown activity_level: ${input.activity_level}`);
  return { ...input, activity_label: `${activity.label} — ${activity.description}` };
}

export function parseCalorieTargetOutput(text: string): CalorieTargetOutput | null {
  return parseJsonWith(CalorieTargetOutputSchema, text);
}
