import {
  KCAL_PER_G_CARB,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  MACRO_PCT_MAX,
  MACRO_PCT_MIN,
} from './params';

export type MacroRatio = { carbPct: number; proteinPct: number; fatPct: number };
export type MacroGrams = { carbG: number; proteinG: number; fatG: number };

export type MacroTargetResult = ({ ok: true } & MacroRatio & MacroGrams) | { ok: false; reason: 'INVALID_RATIO' };

function isValidPct(pct: number): boolean {
  return Number.isInteger(pct) && pct >= MACRO_PCT_MIN && pct <= MACRO_PCT_MAX;
}

function grams(kcal: number, pct: number, kcalPerG: number): number {
  return Math.round(((kcal * pct) / 100 / kcalPerG) * 10) / 10;
}

// Gemini가 준 탄단지 비율을 검사하고, 최종 kcal(하한 보정 후)로 그램을 계산한다(spec 7.1).
export function finalizeMacroTarget(kcal: number, ratio: MacroRatio): MacroTargetResult {
  const { carbPct, proteinPct, fatPct } = ratio;
  if (![carbPct, proteinPct, fatPct].every(isValidPct) || carbPct + proteinPct + fatPct !== 100) {
    return { ok: false, reason: 'INVALID_RATIO' };
  }
  return {
    ok: true,
    carbPct,
    proteinPct,
    fatPct,
    carbG: grams(kcal, carbPct, KCAL_PER_G_CARB),
    proteinG: grams(kcal, proteinPct, KCAL_PER_G_PROTEIN),
    fatG: grams(kcal, fatPct, KCAL_PER_G_FAT),
  };
}
