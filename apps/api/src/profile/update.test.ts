import { CALORIE_TARGET_FIELDS } from '@kkilog/contracts';
import { describe, expect, it } from 'vitest';
import { type EditableProfile, planProfileUpdate } from './update';

const current: EditableProfile = {
  nickname: '민주',
  sex: 'female',
  age: 30,
  height_cm: 162,
  target_weight_kg: 55,
  activity_level: 2,
  goal_months: 4,
};

const changed: Record<(typeof CALORIE_TARGET_FIELDS)[number], unknown> = {
  sex: 'male',
  age: 31,
  height_cm: 162.5,
  target_weight_kg: 54,
  activity_level: 3,
  goal_months: 6,
};

describe('planProfileUpdate', () => {
  it('닉네임만 바꾸면 목표를 다시 정하지 않는다', () => {
    expect(planProfileUpdate(current, { nickname: '새이름' })).toEqual({
      next: { ...current, nickname: '새이름' },
      recalculate: false,
    });
  });

  it.each(CALORIE_TARGET_FIELDS)('%s가 바뀌면 다시 정한다', (field) => {
    const plan = planProfileUpdate(current, { [field]: changed[field] });
    expect(plan.recalculate).toBe(true);
    expect(plan.next[field]).toBe(changed[field]);
  });

  it('같은 값을 다시 보내면 바뀐 것으로 보지 않는다', () => {
    expect(planProfileUpdate(current, { activity_level: 2, goal_months: 4 }).recalculate).toBe(false);
  });
});
