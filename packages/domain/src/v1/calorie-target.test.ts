import { describe, expect, it } from 'vitest';
import { finalizeCalorieTarget } from './calorie-target';
import { CALORIE_TARGET_MAX_KCAL, CALORIE_TARGET_MIN_KCAL, KCAL_PER_KG } from './params';

const base = { maintenanceKcal: 2400, currentWeightKg: 80, targetWeightKg: 70, goalDays: 140 };

describe('finalizeCalorieTarget', () => {
  it('허용 범위 안이면 그대로 쓰고, 예상 기간은 목표 기간이다', () => {
    expect(finalizeCalorieTarget({ ...base, llmKcal: 1850 })).toEqual({
      ok: true,
      kcal: 1850,
      clamped: false,
      expectedDays: 140,
    });
  });

  it('하한·상한 값 자체는 허용한다', () => {
    expect(finalizeCalorieTarget({ ...base, llmKcal: CALORIE_TARGET_MIN_KCAL })).toMatchObject({ clamped: false });
    expect(finalizeCalorieTarget({ ...base, llmKcal: CALORIE_TARGET_MAX_KCAL })).toMatchObject({ ok: true });
  });

  it('하한 미만이면 하한으로 맞추고, 하한 기준 기간을 다시 계산한다', () => {
    const result = finalizeCalorieTarget({ ...base, llmKcal: CALORIE_TARGET_MIN_KCAL - 1 });
    const days = Math.ceil((10 * KCAL_PER_KG) / (base.maintenanceKcal - CALORIE_TARGET_MIN_KCAL));
    expect(result).toEqual({ ok: true, kcal: CALORIE_TARGET_MIN_KCAL, clamped: true, expectedDays: days });
  });

  it('유지 칼로리가 하한 이하라 하한으로는 감량이 안 되면 기간 없음', () => {
    const result = finalizeCalorieTarget({ ...base, maintenanceKcal: CALORIE_TARGET_MIN_KCAL, llmKcal: 900 });
    expect(result).toEqual({ ok: true, kcal: CALORIE_TARGET_MIN_KCAL, clamped: true, expectedDays: null });
  });

  it('감량이 아닌데 하한 미만이면 맞추기만 하고 기간 없음', () => {
    const result = finalizeCalorieTarget({ ...base, targetWeightKg: 85, llmKcal: 1000 });
    expect(result).toMatchObject({ kcal: CALORIE_TARGET_MIN_KCAL, clamped: true, expectedDays: null });
  });

  it('상한 초과는 실패', () => {
    expect(finalizeCalorieTarget({ ...base, llmKcal: CALORIE_TARGET_MAX_KCAL + 1 })).toEqual({
      ok: false,
      reason: 'ABOVE_MAX',
    });
  });
});
