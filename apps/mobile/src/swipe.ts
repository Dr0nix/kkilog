// 홈에서 가로로 밀어 날짜를 넘기는 판정(spec 2.3). 세로 스크롤과 헷갈리지 않게 가로로 확실히 민 경우만 잡는다.

// 이만큼 가로로 움직였고 세로보다 2배 이상 가로일 때 스와이프로 본다(그 전엔 세로 스크롤에 맡김).
export const SWIPE_START_PX = 20;
// 놓았을 때 이만큼 밀었거나, 빠르게 튕겼으면 날짜를 넘긴다.
export const SWIPE_TRIGGER_PX = 70;
export const SWIPE_VELOCITY = 0.6;

export function isHorizontalSwipeStart(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE_START_PX && Math.abs(dx) > Math.abs(dy) * 2;
}

// 손을 뗐을 때 옮길 날 수. 오른쪽으로 밀면 전날(-1), 왼쪽으로 밀면 다음 날(+1), 모자라면 0.
export function swipeDays(dx: number, vx: number): -1 | 0 | 1 {
  if (dx > SWIPE_TRIGGER_PX || (dx > SWIPE_START_PX && vx > SWIPE_VELOCITY)) return -1;
  if (dx < -SWIPE_TRIGGER_PX || (dx < -SWIPE_START_PX && vx < -SWIPE_VELOCITY)) return 1;
  return 0;
}
