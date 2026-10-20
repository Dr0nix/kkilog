import 'server-only';
import type { CalorieTarget } from '@kkilog/contracts';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { finalizeCalorieTarget, finalizeMacroTarget } from '@kkilog/domain';
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
  macros: { carbPct: number; proteinPct: number; fatPct: number; carbG: number; proteinG: number; fatG: number };
  reason: string;
  inputs: CalorieTargetLlmInput;
  modelId: string;
  promptVersion: string;
  raw: unknown;
};

// Gemini로 목표 칼로리·탄단지 비율을 정하고 서버 규칙(하한 보정·상한 실패·비율 검사·그램 계산)을 적용한다(spec 7.1).
// 응답 형식 오류, 상한 초과, 비율 이상도 GeminiError로 던진다 — 호출 측은 저장하지 않고 재시도 가능한 오류로 응답한다.
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

  // 그램은 하한 보정 후의 최종 kcal로 계산한다.
  const macros = finalizeMacroTarget(final.kcal, {
    carbPct: output.carb_pct,
    proteinPct: output.protein_pct,
    fatPct: output.fat_pct,
  });
  if (!macros.ok) {
    throw new GeminiError(`invalid macro ratio: ${output.carb_pct}/${output.protein_pct}/${output.fat_pct}`);
  }

  return {
    kcal: final.kcal,
    llmKcal: output.kcal,
    maintenanceKcal: output.maintenance_kcal,
    clamped: final.clamped,
    expectedDays: final.expectedDays,
    macros: {
      carbPct: macros.carbPct,
      proteinPct: macros.proteinPct,
      fatPct: macros.fatPct,
      carbG: macros.carbG,
      proteinG: macros.proteinG,
      fatG: macros.fatG,
    },
    reason: output.reason,
    inputs,
    modelId: result.model,
    promptVersion: CALORIE_TARGET_PROMPT_VERSION,
    raw: result.raw,
  };
}

// calorie_targets 한 행. 온보딩·프로필 수정 트랜잭션 안에서 쓴다.
export function insertCalorieTarget(sql: NeonQueryFunction<false, false>, userId: string, target: DecidedCalorieTarget) {
  return sql`
    insert into kkilog.calorie_targets
      (user_id, kcal, llm_kcal, maintenance_kcal, clamped, carb_pct, protein_pct, fat_pct, carb_g, protein_g, fat_g,
       reason, inputs, model_id, prompt_version, raw_response)
    values
      (${userId}, ${target.kcal}, ${target.llmKcal}, ${target.maintenanceKcal}, ${target.clamped},
       ${target.macros.carbPct}, ${target.macros.proteinPct}, ${target.macros.fatPct},
       ${target.macros.carbG}, ${target.macros.proteinG}, ${target.macros.fatG}, ${target.reason},
       ${JSON.stringify(target.inputs)}::jsonb, ${target.modelId}, ${target.promptVersion},
       ${JSON.stringify(target.raw)}::jsonb)`;
}

export function toCalorieTargetResponse(target: DecidedCalorieTarget): CalorieTarget {
  return {
    kcal: target.kcal,
    clamped: target.clamped,
    expected_days: target.expectedDays,
    macros: {
      carb_pct: target.macros.carbPct,
      protein_pct: target.macros.proteinPct,
      fat_pct: target.macros.fatPct,
      carb_g: target.macros.carbG,
      protein_g: target.macros.proteinG,
      fat_g: target.macros.fatG,
    },
    reason: target.reason,
  };
}
