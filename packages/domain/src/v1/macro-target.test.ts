import { describe, expect, it } from 'vitest';
import { finalizeMacroTarget } from './macro-target';
import {
  CALORIE_TARGET_MAX_KCAL,
  CALORIE_TARGET_MIN_KCAL,
  KCAL_PER_G_CARB,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  MACRO_PCT_MAX,
  MACRO_PCT_MIN,
} from './params';

const ratio = { carbPct: 45, proteinPct: 30, fatPct: 25 };
const round1 = (n: number) => Math.round(n * 10) / 10;

describe('finalizeMacroTarget', () => {
  it('비율을 그대로 두고 그램은 kcal × 비율 ÷ g당 kcal(소수 첫째 자리)', () => {
    expect(finalizeMacroTarget(1850, ratio)).toEqual({
      ok: true,
      ...ratio,
      carbG: round1((1850 * 0.45) / KCAL_PER_G_CARB),
      proteinG: round1((1850 * 0.3) / KCAL_PER_G_PROTEIN),
      fatG: round1((1850 * 0.25) / KCAL_PER_G_FAT),
    });
  });

  it('하한으로 맞춘 kcal이 들어오면 그 kcal 기준으로 계산한다', () => {
    const result = finalizeMacroTarget(CALORIE_TARGET_MIN_KCAL, ratio);
    expect(result).toMatchObject({ ok: true, carbG: round1((CALORIE_TARGET_MIN_KCAL * 0.45) / KCAL_PER_G_CARB) });
  });

  it('그램을 kcal로 되돌리면 목표 kcal과 거의 같다', () => {
    const result = finalizeMacroTarget(2137, { carbPct: 50, proteinPct: 20, fatPct: 30 });
    if (!result.ok) throw new Error('expected ok');
    const back = result.carbG * KCAL_PER_G_CARB + result.proteinG * KCAL_PER_G_PROTEIN + result.fatG * KCAL_PER_G_FAT;
    expect(Math.abs(back - 2137)).toBeLessThan(1);
  });

  it('허용 범위 끝값은 받는다', () => {
    const max = MACRO_PCT_MAX;
    const rest = 100 - max;
    const fat = Math.max(MACRO_PCT_MIN, rest - MACRO_PCT_MIN);
    expect(finalizeMacroTarget(CALORIE_TARGET_MAX_KCAL, { carbPct: max, proteinPct: rest - fat, fatPct: fat })).toMatchObject({
      ok: true,
    });
  });

  it.each([
    ['합이 100이 아님', { carbPct: 45, proteinPct: 30, fatPct: 24 }],
    ['하한 미만', { carbPct: 60, proteinPct: 100 - 60 - (MACRO_PCT_MIN - 1), fatPct: MACRO_PCT_MIN - 1 }],
    ['상한 초과', { carbPct: MACRO_PCT_MAX + 1, proteinPct: 100 - MACRO_PCT_MAX - 1 - MACRO_PCT_MIN, fatPct: MACRO_PCT_MIN }],
    ['정수가 아님', { carbPct: 45.5, proteinPct: 29.5, fatPct: 25 }],
  ])('%s → 실패', (_name, bad) => {
    expect(finalizeMacroTarget(1850, bad)).toEqual({ ok: false, reason: 'INVALID_RATIO' });
  });
});
