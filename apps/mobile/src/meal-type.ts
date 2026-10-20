import type { MealType } from '@kkilog/contracts';

// 기록 화면에서 미리 골라 두는 끼니 태그(spec 2.4). 사용자가 바꿀 수 있다.
export function defaultMealType(now: Date): MealType {
  const hour = now.getHours();
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 17) return 'snack';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'late_night';
}
