import { z } from 'zod';
import { jsonSchemaForGemini, parseJsonWith } from './json';

// 프롬프트 파일: prompts/meal-analysis/v1.md. 프롬프트·출력 스키마를 바꾸면 버전을 올린다(기존 파일 수정 금지).
export const MEAL_ANALYSIS_PROMPT = { name: 'meal-analysis', version: 'v1' } as const;
export const MEAL_ANALYSIS_PROMPT_VERSION = `${MEAL_ANALYSIS_PROMPT.name}/${MEAL_ANALYSIS_PROMPT.version}`;

// 음수·상한 검사는 domain(normalizeMeal)이 한다. 여기선 형태만 본다.
export const MealItemOutputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number(),
  unit: z.string().trim().min(1).max(20),
  estimated_grams: z.number(),
  kcal: z.number(),
  carb_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const MealAnalysisOutputSchema = z.object({
  items: z.array(MealItemOutputSchema),
  notes: z.string().max(500),
});
export type MealAnalysisOutput = z.infer<typeof MealAnalysisOutputSchema>;

export const mealAnalysisResponseJsonSchema = jsonSchemaForGemini(MealAnalysisOutputSchema);

export type MealAnalysisLlmInput = {
  input_text: string | null;
  correction_text: string | null;
};

export function parseMealAnalysisOutput(text: string): MealAnalysisOutput | null {
  return parseJsonWith(MealAnalysisOutputSchema, text);
}
