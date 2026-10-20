import { MEAL_EATEN_AT_FUTURE_SKEW_MS, MEAL_EATEN_AT_MAX_PAST_DAYS } from './params';

const DAY_MS = 24 * 60 * 60 * 1000;

// 사용자가 고른 먹은 시각을 받을지(spec 2.4). 미래(시계 오차 허용)와 너무 오래된 시각은 거부한다.
export function isAcceptableEatenAt(eatenAt: Date, now: Date): boolean {
  const t = eatenAt.getTime();
  if (Number.isNaN(t)) return false;
  return t <= now.getTime() + MEAL_EATEN_AT_FUTURE_SKEW_MS && t >= now.getTime() - MEAL_EATEN_AT_MAX_PAST_DAYS * DAY_MS;
}
