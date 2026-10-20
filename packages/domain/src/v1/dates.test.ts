import { describe, expect, it } from 'vitest';
import { ageOn, birthYearFromAge, daysUntilMonthsLater, localDate } from './dates';

describe('localDate', () => {
  it('타임존 기준 날짜를 쓴다', () => {
    const instant = new Date('2026-10-19T16:30:00Z'); // 서울은 다음 날 01:30
    expect(localDate(instant, 'Asia/Seoul')).toBe('2026-10-20');
    expect(localDate(instant, 'UTC')).toBe('2026-10-19');
  });
});

describe('birthYearFromAge / ageOn', () => {
  it('출생연도로 바꿨다가 같은 해엔 같은 나이로 돌아온다', () => {
    const birthYear = birthYearFromAge('2026-10-19', 30);
    expect(birthYear).toBe(1996);
    expect(ageOn('2026-12-31', birthYear)).toBe(30);
    expect(ageOn('2027-01-01', birthYear)).toBe(31);
  });
});

describe('daysUntilMonthsLater', () => {
  it('달력 기준으로 센다', () => {
    expect(daysUntilMonthsLater('2026-10-19', 1)).toBe(31);
    expect(daysUntilMonthsLater('2026-10-19', 12)).toBe(365);
  });

  it('해를 넘어간다', () => {
    expect(daysUntilMonthsLater('2026-11-15', 3)).toBe(92);
  });

  it('그 달에 같은 날이 없으면 말일로 맞춘다', () => {
    expect(daysUntilMonthsLater('2026-01-31', 1)).toBe(28); // 2026-02-28
    expect(daysUntilMonthsLater('2028-01-31', 1)).toBe(29); // 윤년 2028-02-29
  });
});
