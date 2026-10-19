import { describe, expect, it } from 'vitest';
import { buildCalorieTargetInput, calorieTargetResponseJsonSchema, parseCalorieTargetOutput } from './calorie-target';

// 실제 gemini-3.8-flash 응답(prompts/calorie-target/v1.md)에서 가져온 fixture
const FIXTURES = {
  normal:
    '{"maintenance_kcal": 2405, "kcal": 1855, "reason": "유지 칼로리 약 2,405kcal(기초대사 약 1,749kcal × 활동계수 1.375)에서 하루 목표 감량치 550kcal(10kg × 7,700kcal ÷ 140일)를 제외하여 1,855kcal로 계산되었습니다."}',
  negative:
    '{"maintenance_kcal": 1559, "kcal": -1008, "reason": "유지 칼로리 약 1,559(기초대사 약 1,299 × 활동 1.2) − 하루 2,567(10kg 감량 × 7,700 ÷ 30일) ≈ -1,008"}',
};

describe('parseCalorieTargetOutput', () => {
  it('정상 응답을 읽는다', () => {
    expect(parseCalorieTargetOutput(FIXTURES.normal)).toMatchObject({ maintenance_kcal: 2405, kcal: 1855 });
  });

  it('무리한 목표의 음수 kcal도 받는다(하한 보정은 domain이 한다)', () => {
    expect(parseCalorieTargetOutput(FIXTURES.negative)).toMatchObject({ kcal: -1008 });
  });

  it.each([
    ['JSON이 아님', 'not json'],
    ['필드 누락', '{"kcal": 1800, "reason": "x"}'],
    ['정수가 아님', '{"maintenance_kcal": 2400.5, "kcal": 1800, "reason": "x"}'],
    ['유지 칼로리 0', '{"maintenance_kcal": 0, "kcal": 1800, "reason": "x"}'],
    ['근거 비어 있음', '{"maintenance_kcal": 2400, "kcal": 1800, "reason": ""}'],
  ])('%s → null', (_name, text) => {
    expect(parseCalorieTargetOutput(text)).toBeNull();
  });

  it('모르는 필드는 버린다', () => {
    expect(parseCalorieTargetOutput('{"maintenance_kcal": 2400, "kcal": 1800, "reason": "x", "total": 1}')).toEqual({
      maintenance_kcal: 2400,
      kcal: 1800,
      reason: 'x',
    });
  });
});

describe('calorieTargetResponseJsonSchema', () => {
  it('$schema 키 없이 세 필드를 모두 요구한다', () => {
    expect(calorieTargetResponseJsonSchema).not.toHaveProperty('$schema');
    expect(calorieTargetResponseJsonSchema.required).toEqual(['maintenance_kcal', 'kcal', 'reason']);
  });
});

describe('buildCalorieTargetInput', () => {
  it('운동 정도 설명을 붙인다', () => {
    const input = buildCalorieTargetInput({
      sex: 'male',
      age: 30,
      height_cm: 175,
      weight_kg: 80,
      target_weight_kg: 70,
      activity_level: 2,
      goal_days: 140,
    });
    expect(input.activity_label).toBe('가벼움 — 주 1~2회 가벼운 운동');
  });
});
