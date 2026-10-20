import { describe, expect, it } from 'vitest';
import { isAcceptableEatenAt } from './eaten-at';
import { MEAL_EATEN_AT_FUTURE_SKEW_MS, MEAL_EATEN_AT_MAX_PAST_DAYS } from './params';

const now = new Date('2026-10-20T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(now.getTime() + ms);

describe('isAcceptableEatenAt', () => {
  it('지금과 과거는 받는다', () => {
    expect(isAcceptableEatenAt(now, now)).toBe(true);
    expect(isAcceptableEatenAt(at(-3 * 60 * 60 * 1000), now)).toBe(true);
  });

  it('최대 기간 끝까지는 받고, 넘으면 거부', () => {
    expect(isAcceptableEatenAt(at(-MEAL_EATEN_AT_MAX_PAST_DAYS * DAY_MS), now)).toBe(true);
    expect(isAcceptableEatenAt(at(-MEAL_EATEN_AT_MAX_PAST_DAYS * DAY_MS - 1), now)).toBe(false);
  });

  it('미래는 시계 오차만큼만 봐준다', () => {
    expect(isAcceptableEatenAt(at(MEAL_EATEN_AT_FUTURE_SKEW_MS), now)).toBe(true);
    expect(isAcceptableEatenAt(at(MEAL_EATEN_AT_FUTURE_SKEW_MS + 1), now)).toBe(false);
  });

  it('잘못된 날짜는 거부', () => {
    expect(isAcceptableEatenAt(new Date('x'), now)).toBe(false);
  });
});
