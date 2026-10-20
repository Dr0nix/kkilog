import { describe, expect, it } from 'vitest';
import { buildCalorieTargetInput, calorieTargetResponseJsonSchema, parseCalorieTargetOutput } from './calorie-target';

// 실제 gemini-3.5-flash-lite 응답(prompts/calorie-target/v2.md)에서 가져온 fixture
const FIXTURES = {
  normal:
    '{"maintenance_kcal":2275,"kcal":1725,"carb_pct":45,"protein_pct":30,"fat_pct":25,"reason":"유지 칼로리 약 2,275(기초대사 약 1,750 × 활동 1.3) - 하루 550(10kg × 7,700 ÷ 140일) ≈ 1,725. 감량 중 근손실을 방지하고 포만감을 유지하기 위해 단백질 비율을 30%로 높이고 탄수화물과 지방을 적절히 배분했습니다."}',
  negative:
    '{"maintenance_kcal":1425,"kcal":-1140,"carb_pct":45,"protein_pct":35,"fat_pct":20,"reason":"유지 칼로리 약 1,425(기초대사 약 1,286 × 활동 1.1) + 하루 -2,567(감량분)을 반영하여 섭취 칼로리를 산출했습니다. 한 달 내 단기 감량이므로 근손실을 최소화하기 위해 단백질 비율을 35%로 높이고 탄수화물과 지방을 적정 수준으로 배분했습니다."}',
};

const valid = { maintenance_kcal: 2400, kcal: 1800, carb_pct: 45, protein_pct: 30, fat_pct: 25, reason: 'x' };
const json = (patch: Record<string, unknown>) => JSON.stringify({ ...valid, ...patch });

describe('parseCalorieTargetOutput', () => {
  it('정상 응답을 읽는다', () => {
    expect(parseCalorieTargetOutput(FIXTURES.normal)).toMatchObject({
      maintenance_kcal: 2275,
      kcal: 1725,
      carb_pct: 45,
      protein_pct: 30,
      fat_pct: 25,
    });
  });

  it('무리한 목표의 음수 kcal도 받는다(하한 보정은 domain이 한다)', () => {
    expect(parseCalorieTargetOutput(FIXTURES.negative)).toMatchObject({ kcal: -1140 });
  });

  it('비율 범위·합은 여기서 보지 않는다(domain이 검사)', () => {
    expect(parseCalorieTargetOutput(json({ carb_pct: 90, protein_pct: 30, fat_pct: 25 }))).toMatchObject({ carb_pct: 90 });
  });

  it.each([
    ['JSON이 아님', 'not json'],
    ['필드 누락', '{"kcal": 1800, "reason": "x"}'],
    ['탄단지 비율 누락(v1 형식)', '{"maintenance_kcal": 2400, "kcal": 1800, "reason": "x"}'],
    ['정수가 아님', json({ maintenance_kcal: 2400.5 })],
    ['비율이 정수가 아님', json({ carb_pct: 45.5 })],
    ['유지 칼로리 0', json({ maintenance_kcal: 0 })],
    ['근거 비어 있음', json({ reason: '' })],
  ])('%s → null', (_name, text) => {
    expect(parseCalorieTargetOutput(text)).toBeNull();
  });

  it('모르는 필드는 버린다', () => {
    expect(parseCalorieTargetOutput(json({ carb_g: 200 }))).toEqual(valid);
  });
});

describe('calorieTargetResponseJsonSchema', () => {
  it('$schema 키 없이 모든 필드를 요구한다', () => {
    expect(calorieTargetResponseJsonSchema).not.toHaveProperty('$schema');
    expect(calorieTargetResponseJsonSchema.required).toEqual([
      'maintenance_kcal',
      'kcal',
      'carb_pct',
      'protein_pct',
      'fat_pct',
      'reason',
    ]);
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
