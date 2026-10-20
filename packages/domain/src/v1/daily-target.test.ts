import { describe, expect, it } from 'vitest';
import { remainingToTarget } from './daily-target';

describe('remainingToTarget', () => {
  it('목표 − 먹은 양, 넘으면 음수', () => {
    expect(
      remainingToTarget(
        { kcal: 1850, carb_g: 208.1, protein_g: 138.8, fat_g: 51.4 },
        { kcal: 2000, carb_g: 150.25, protein_g: 40, fat_g: 60 },
      ),
    ).toEqual({ kcal: -150, carb_g: 57.9, protein_g: 98.8, fat_g: -8.6 });
  });

  it('탄단지 목표가 없으면 그램은 null', () => {
    expect(
      remainingToTarget({ kcal: 1850, carb_g: null, protein_g: null, fat_g: null }, { kcal: 600, carb_g: 80, protein_g: 20, fat_g: 15 }),
    ).toEqual({ kcal: 1250, carb_g: null, protein_g: null, fat_g: null });
  });
});
