import { describe, expect, it } from 'vitest';
import { OnboardingRequestSchema } from './onboarding';

const valid = {
  nickname: '민주',
  sex: 'female',
  age: 30,
  height_cm: 162.34,
  weight_kg: 60.06,
  target_weight_kg: 55,
  activity_level: 2,
  goal_months: 4,
};

describe('OnboardingRequestSchema', () => {
  it('키·체중은 소수 첫째 자리로 반올림한다', () => {
    expect(OnboardingRequestSchema.parse(valid)).toMatchObject({ height_cm: 162.3, weight_kg: 60.1 });
  });

  it('닉네임은 앞뒤 공백을 빼고 문자 수 1~20자', () => {
    expect(OnboardingRequestSchema.parse({ ...valid, nickname: '  민주  ' }).nickname).toBe('민주');
    expect(OnboardingRequestSchema.safeParse({ ...valid, nickname: '   ' }).success).toBe(false);
    expect(OnboardingRequestSchema.safeParse({ ...valid, nickname: '😀'.repeat(20) }).success).toBe(true);
    expect(OnboardingRequestSchema.safeParse({ ...valid, nickname: '가'.repeat(21) }).success).toBe(false);
  });

  it.each([
    ['age', 13],
    ['age', 101],
    ['age', 30.5],
    ['height_cm', 99.9],
    ['weight_kg', 300.1],
    ['target_weight_kg', 19],
    ['activity_level', 0],
    ['activity_level', 6],
    ['goal_months', 0],
    ['goal_months', 25],
    ['sex', 'other'],
  ])('%s = %s 는 거부한다', (field, value) => {
    expect(OnboardingRequestSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});
