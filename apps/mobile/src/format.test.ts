import { describe, expect, it } from 'vitest';
import { eatenAtOn, formatKg, formatLocalDate, parseTime, shiftLocalDate } from './format';

describe('format', () => {
  it('날짜에 요일을 붙인다', () => {
    expect(formatLocalDate('2026-10-20')).toBe('10월 20일 (화)');
  });

  it('날짜를 하루씩 옮긴다(달·해 넘김)', () => {
    expect(shiftLocalDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftLocalDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('kg은 소수 첫째 자리', () => {
    expect(formatKg(79.46)).toBe('79.5kg');
    expect(formatKg(80)).toBe('80.0kg');
  });
});

describe('parseTime', () => {
  it.each([
    ['12:30', { hour: 12, minute: 30 }],
    ['1230', { hour: 12, minute: 30 }],
    ['9:05', { hour: 9, minute: 5 }],
    [' 905 ', { hour: 9, minute: 5 }],
    ['0:00', { hour: 0, minute: 0 }],
  ])('%s', (text, expected) => {
    expect(parseTime(text)).toEqual(expected);
  });

  it.each(['24:00', '12:60', '12', '12:3', 'ab:cd', ''])('%s → null', (text) => {
    expect(parseTime(text)).toBeNull();
  });
});

describe('eatenAtOn', () => {
  it('며칠 전 그 시각(달 넘김)', () => {
    const now = new Date(2026, 10, 1, 9, 0); // 11월 1일
    const result = eatenAtOn(now, 1, 21, 30);
    expect([result.getMonth(), result.getDate(), result.getHours(), result.getMinutes()]).toEqual([9, 31, 21, 30]);
  });
});
