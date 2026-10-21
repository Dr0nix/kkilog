import { describe, expect, it } from 'vitest';
import { SWIPE_START_PX, SWIPE_TRIGGER_PX, SWIPE_VELOCITY, isHorizontalSwipeStart, swipeDays } from './swipe';

describe('isHorizontalSwipeStart', () => {
  it('가로로 충분히, 세로보다 확실히 많이 움직이면 스와이프', () => {
    expect(isHorizontalSwipeStart(SWIPE_START_PX + 1, 5)).toBe(true);
    expect(isHorizontalSwipeStart(-(SWIPE_START_PX + 1), -5)).toBe(true);
  });

  it('조금만 움직였거나 비스듬하면(세로 스크롤) 아니다', () => {
    expect(isHorizontalSwipeStart(SWIPE_START_PX, 0)).toBe(false);
    expect(isHorizontalSwipeStart(40, 25)).toBe(false);
    expect(isHorizontalSwipeStart(5, 80)).toBe(false);
  });
});

describe('swipeDays', () => {
  it('오른쪽으로 밀면 전날, 왼쪽으로 밀면 다음 날', () => {
    expect(swipeDays(SWIPE_TRIGGER_PX + 1, 0)).toBe(-1);
    expect(swipeDays(-(SWIPE_TRIGGER_PX + 1), 0)).toBe(1);
  });

  it('짧게라도 빠르게 튕기면 넘긴다', () => {
    expect(swipeDays(SWIPE_START_PX + 5, SWIPE_VELOCITY + 0.1)).toBe(-1);
    expect(swipeDays(-(SWIPE_START_PX + 5), -(SWIPE_VELOCITY + 0.1))).toBe(1);
  });

  it('모자라면 그대로', () => {
    expect(swipeDays(SWIPE_TRIGGER_PX - 1, 0)).toBe(0);
    expect(swipeDays(SWIPE_START_PX + 5, SWIPE_VELOCITY - 0.1)).toBe(0);
  });
});
