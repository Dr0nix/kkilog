import type { Profile } from '@kkilog/contracts';
import { describe, expect, it } from 'vitest';
import { changes, toForm } from './profile-form';

const profile: Profile = {
  nickname: '민주',
  sex: 'female',
  age: 30,
  height_cm: 162,
  target_weight_kg: 55,
  activity_level: 2,
  goal_months: 4,
  latest_weight_kg: 60,
};

describe('changes', () => {
  it('그대로면 보낼 게 없다', () => {
    expect(changes(profile, toForm(profile))).toEqual({});
  });

  it('바뀐 항목만, 숫자는 숫자로(쉼표 소수점 포함)', () => {
    expect(changes(profile, { ...toForm(profile), nickname: ' 새이름 ', height_cm: '162,5', activity_level: 3 })).toEqual({
      nickname: '새이름',
      height_cm: 162.5,
      activity_level: 3,
    });
  });

  it('빈 칸은 NaN으로 넘겨 스키마가 거부하게 한다', () => {
    expect(Number.isNaN(changes(profile, { ...toForm(profile), age: '' }).age)).toBe(true);
  });
});
