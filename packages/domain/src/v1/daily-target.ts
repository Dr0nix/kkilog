import type { MealTotals } from './meal';

// 하루 목표. 탄단지 목표가 없는 사용자(calorie-target/v1)는 그램이 null이다.
export type DailyTarget = { kcal: number; carb_g: number | null; protein_g: number | null; fat_g: number | null };

const round1 = (value: number) => Math.round(value * 10) / 10;
const minus = (target: number | null, consumed: number) => (target === null ? null : round1(target - consumed));

// 목표까지 남은 양. 음수면 그만큼 넘었다는 뜻이다(spec 6.2 조언 입력).
export function remainingToTarget(target: DailyTarget, consumed: MealTotals): DailyTarget {
  return {
    kcal: target.kcal - consumed.kcal,
    carb_g: minus(target.carb_g, consumed.carb_g),
    protein_g: minus(target.protein_g, consumed.protein_g),
    fat_g: minus(target.fat_g, consumed.fat_g),
  };
}
