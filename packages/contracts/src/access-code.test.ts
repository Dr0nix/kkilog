import { describe, expect, it } from 'vitest';
import { ACCESS_CODE_LENGTH, AccessCodeSchema, formatAccessCode, normalizeAccessCode } from './access-code';

const CODE = '7HQ2K9MDX4RTPB3NW8ZF';

describe('normalizeAccessCode', () => {
  it('하이픈·공백·소문자를 무시한다', () => {
    expect(normalizeAccessCode(' 7hq2-k9md x4rt-pb3n-w8zf ')).toBe(CODE);
  });

  it('O는 0, I·L은 1로 읽는다', () => {
    expect(normalizeAccessCode('OOOO-IIII-LLLL-0000-1111')).toBe('00001111111100001111');
  });

  it('길이나 문자가 틀리면 null', () => {
    expect(normalizeAccessCode(CODE.slice(1))).toBeNull();
    expect(normalizeAccessCode(`${CODE}0`)).toBeNull();
    expect(normalizeAccessCode(`${CODE.slice(1)}U`)).toBeNull();
    expect(normalizeAccessCode('')).toBeNull();
  });
});

describe('formatAccessCode', () => {
  it('4자씩 하이픈으로 묶고, 다시 정규화하면 원래 코드가 된다', () => {
    const formatted = formatAccessCode(CODE);
    expect(formatted).toBe('7HQ2-K9MD-X4RT-PB3N-W8ZF');
    expect(normalizeAccessCode(formatted)).toBe(CODE);
    expect(formatted.replace(/-/g, '')).toHaveLength(ACCESS_CODE_LENGTH);
  });
});

describe('AccessCodeSchema', () => {
  it('정규화한 코드를 돌려주고, 틀린 형식은 거부한다', () => {
    expect(AccessCodeSchema.parse('7hq2-k9md-x4rt-pb3n-w8zf')).toBe(CODE);
    expect(AccessCodeSchema.safeParse('nope').success).toBe(false);
  });
});
