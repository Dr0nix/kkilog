import { CALORIE_TARGET_MAX_KCAL, CALORIE_TARGET_MIN_KCAL, KCAL_PER_KG } from './params';

export type CalorieTargetInput = {
  llmKcal: number;
  maintenanceKcal: number;
  currentWeightKg: number;
  targetWeightKg: number;
  goalDays: number;
};

export type CalorieTargetResult =
  | { ok: true; kcal: number; clamped: boolean; expectedDays: number | null }
  | { ok: false; reason: 'ABOVE_MAX' };

// Gemini가 준 목표 칼로리를 허용 범위에 맞춘다(spec 7.1).
// 하한 미만이면 하한으로 맞추고, 그 섭취량으로 걸리는 기간을 다시 계산한다.
export function finalizeCalorieTarget(input: CalorieTargetInput): CalorieTargetResult {
  if (input.llmKcal > CALORIE_TARGET_MAX_KCAL) return { ok: false, reason: 'ABOVE_MAX' };
  if (input.llmKcal >= CALORIE_TARGET_MIN_KCAL) {
    return { ok: true, kcal: input.llmKcal, clamped: false, expectedDays: input.goalDays };
  }

  // 감량이고 유지 칼로리가 하한보다 높을 때만 하한 기준 기간을 낼 수 있다.
  const lossKg = input.currentWeightKg - input.targetWeightKg;
  const dailyDeficit = input.maintenanceKcal - CALORIE_TARGET_MIN_KCAL;
  const expectedDays = lossKg > 0 && dailyDeficit > 0 ? Math.ceil((lossKg * KCAL_PER_KG) / dailyDeficit) : null;
  return { ok: true, kcal: CALORIE_TARGET_MIN_KCAL, clamped: true, expectedDays };
}
