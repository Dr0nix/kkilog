import 'server-only';
import type { AnalysisError } from '@kkilog/contracts';
import { type MealItemInput, type MealTotals, normalizeMeal } from '@kkilog/domain';
import {
  MEAL_ANALYSIS_PROMPT,
  MEAL_ANALYSIS_PROMPT_VERSION,
  type MealAnalysisLlmInput,
  mealAnalysisResponseJsonSchema,
  parseMealAnalysisOutput,
} from '../llm/meal-analysis';
import { type GeminiImage, GeminiError, generateJson, geminiModel } from './gemini';
import { loadPrompt } from './prompts';

// meal_analyses 한 행에 그대로 들어가는 값(spec 5·6). 실패도 행으로 남겨 [재시도]할 수 있게 한다.
export type MealAnalysisResult = { modelId: string; promptVersion: string; correctionText: string | null } & (
  | { status: 'ok'; items: MealItemInput[]; totals: MealTotals; notes: string; raw: unknown }
  | { status: 'failed'; error: AnalysisError; raw: unknown | null }
);

// 사진·텍스트로 끼니를 분석한다. 예외를 던지지 않고 실패도 결과로 돌려준다.
export async function analyzeMeal(args: {
  inputText: string | null;
  correctionText: string | null;
  image: GeminiImage | null;
}): Promise<MealAnalysisResult> {
  const base = { promptVersion: MEAL_ANALYSIS_PROMPT_VERSION, correctionText: args.correctionText };
  const input: MealAnalysisLlmInput = { input_text: args.inputText, correction_text: args.correctionText };

  let result;
  try {
    result = await generateJson({
      systemInstruction: await loadPrompt(MEAL_ANALYSIS_PROMPT.name, MEAL_ANALYSIS_PROMPT.version),
      input,
      images: args.image ? [args.image] : [],
      responseJsonSchema: mealAnalysisResponseJsonSchema,
    });
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    console.error('meal analysis: gemini failed', error);
    return { ...base, modelId: geminiModel(), status: 'failed', error: 'GEMINI_UNAVAILABLE', raw: null };
  }

  const fail = (error: AnalysisError) => ({ ...base, modelId: result.model, status: 'failed' as const, error, raw: result.raw });
  const output = parseMealAnalysisOutput(result.text);
  if (!output) return fail('INVALID_OUTPUT');

  const normalized = normalizeMeal(output.items);
  if (!normalized.ok) return fail(normalized.reason);

  return {
    ...base,
    modelId: result.model,
    status: 'ok',
    items: normalized.items,
    totals: normalized.totals,
    notes: output.notes,
    raw: result.raw,
  };
}
