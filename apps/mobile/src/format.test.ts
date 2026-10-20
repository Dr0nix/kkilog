import { describe, expect, it } from 'vitest';
import { formatKg, formatLocalDate, shiftLocalDate } from './format';

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
