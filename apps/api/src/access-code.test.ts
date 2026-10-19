import { ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH, normalizeAccessCode } from '@kkilog/contracts';
import { describe, expect, it } from 'vitest';
import { generateAccessCode, hashAccessCode, parseBearer } from './access-code';

describe('generateAccessCode', () => {
  it('Crockford Base32 20자이고 정규화해도 그대로다', () => {
    const code = generateAccessCode();
    expect(code).toHaveLength(ACCESS_CODE_LENGTH);
    expect([...code].every((c) => ACCESS_CODE_ALPHABET.includes(c))).toBe(true);
    expect(normalizeAccessCode(code)).toBe(code);
  });

  it('매번 다른 코드를 만든다', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateAccessCode));
    expect(codes.size).toBe(1000);
  });
});

describe('hashAccessCode', () => {
  it('SHA-256 hex를 돌려준다', async () => {
    expect(await hashAccessCode('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('parseBearer', () => {
  it('Bearer 뒤의 코드를 정규화해서 꺼낸다', () => {
    expect(parseBearer('Bearer 7hq2-k9md-x4rt-pb3n-w8zf')).toBe('7HQ2K9MDX4RTPB3NW8ZF');
    expect(parseBearer('bearer 7HQ2K9MDX4RTPB3NW8ZF')).toBe('7HQ2K9MDX4RTPB3NW8ZF');
  });

  it('헤더가 없거나 형식이 틀리면 null', () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer('')).toBeNull();
    expect(parseBearer('Basic 7HQ2K9MDX4RTPB3NW8ZF')).toBeNull();
    expect(parseBearer('Bearer ')).toBeNull();
    expect(parseBearer('Bearer short')).toBeNull();
  });
});
