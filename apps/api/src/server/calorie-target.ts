import 'server-only';
import { finalizeCalorieTarget } from '@kkilog/domain';
import {
  CALORIE_TARGET_PROMPT,
  CALORIE_TARGET_PROMPT_VERSION,
  type CalorieTargetLlmInput,
  calorieTargetResponseJsonSchema,
  parseCalorieTargetOutput,
} from '../llm/calorie-target';
import { GeminiError, generateJson } from './gemini';
import { loadPrompt } from './prompts';

export type DecidedCalorieTarget = {
  kcal: number;
  llmKcal: number;
  maintenanceKcal: number;
  clamped: boolean;
  expectedDays: number | null;
  reason: string;
  inputs: CalorieTargetLlmInput;
  modelId: string;
  promptVersion: string;
  raw: unknown;
};

// Gemini로 목표 칼로리를 정하고 서버 규칙(하한 보정·상한 실패)을 적용한다(spec 7.1).
// 응답 형식 오류나 상한 초과도 GeminiError로 던진다 — 호출 측은 저장하지 않고 재시도 가능한 오류로 응답한다.
export async function decideCalorieTarget(inputs: CalorieTargetLlmInput): Promise<DecidedCalorieTarget> {
  const result = await generateJson({
    systemInstruction: await loadPrompt(CALORIE_TARGET_PROMPT.name, CALORIE_TARGET_PROMPT.version),
    input: inputs,
    responseJsonSchema: calorieTargetResponseJsonSchema,
  });

  const output = parseCalorieTargetOutput(result.text);
  if (!output) throw new GeminiError(`invalid calorie target output: ${result.text.slice(0, 200)}`);

  const final = finalizeCalorieTarget({
    llmKcal: output.kcal,
    maintenanceKcal: output.maintenance_kcal,
    currentWeightKg: inputs.weight_kg,
    targetWeightKg: inputs.target_weight_kg,
    goalDays: inputs.goal_days,
  });
  if (!final.ok) throw new GeminiError(`calorie target above max: ${output.kcal}`);

  return {
    kcal: final.kcal,
    llmKcal: output.kcal,
    maintenanceKcal: output.maintenance_kcal,
    clamped: final.clamped,
    expectedDays: final.expectedDays,
    reason: output.reason,
    inputs,
    modelId: result.model,
    promptVersion: CALORIE_TARGET_PROMPT_VERSION,
    raw: result.raw,
  };
}
