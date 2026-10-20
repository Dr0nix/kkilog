import { describe, expect, it } from 'vitest';
import { defaultMealType } from './meal-type';

const at = (hour: number, minute = 0) => new Date(2026, 9, 20, hour, minute);

describe('defaultMealType', () => {
  it.each([
    [5, 0, 'breakfast'],
    [9, 59, 'breakfast'],
    [10, 0, 'lunch'],
    [14, 59, 'lunch'],
    [15, 0, 'snack'],
    [17, 0, 'dinner'],
    [20, 59, 'dinner'],
    [21, 0, 'late_night'],
    [0, 30, 'late_night'],
    [4, 59, 'late_night'],
  ])('%d:%d → %s', (hour, minute, expected) => {
    expect(defaultMealType(at(hour, minute))).toBe(expected);
  });
});
