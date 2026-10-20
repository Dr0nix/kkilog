import { describe, expect, it } from 'vitest';
import { HomeQuerySchema, LocalDateSchema } from './home';
import { UpdateProfileRequestSchema } from './profile';

describe('LocalDateSchema', () => {
  it.each(['2026-10-20', '2028-02-29'])('%s 통과', (value) => {
    expect(LocalDateSchema.safeParse(value).success).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-1-1', '20261020', ''])('%s 거부', (value) => {
    expect(LocalDateSchema.safeParse(value).success).toBe(false);
  });

  it('home의 date는 생략할 수 있다', () => {
    expect(HomeQuerySchema.parse({})).toEqual({});
  });
});

describe('UpdateProfileRequestSchema', () => {
  it('바꿀 항목만 받는다', () => {
    expect(UpdateProfileRequestSchema.parse({ activity_level: 3 })).toEqual({ activity_level: 3 });
  });

  it('빈 요청은 거부', () => {
    expect(UpdateProfileRequestSchema.safeParse({}).success).toBe(false);
  });

  it('몸무게는 받지 않는다(체중 기록으로 남김)', () => {
    expect(UpdateProfileRequestSchema.parse({ weight_kg: 70, nickname: '새이름' })).toEqual({ nickname: '새이름' });
    expect(UpdateProfileRequestSchema.safeParse({ weight_kg: 70 }).success).toBe(false);
  });

  it('온보딩과 같은 범위로 검사한다', () => {
    expect(UpdateProfileRequestSchema.safeParse({ goal_months: 25 }).success).toBe(false);
    expect(UpdateProfileRequestSchema.parse({ height_cm: 172.34 })).toEqual({ height_cm: 172.3 });
  });
});
