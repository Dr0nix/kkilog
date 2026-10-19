import { z } from 'zod';

// Crockford Base32: 헷갈리는 I, L, O, U를 뺀 32자.
export const ACCESS_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ACCESS_CODE_LENGTH = 20; // 5비트 × 20 = 100비트

const VALID = new RegExp(`^[${ACCESS_CODE_ALPHABET}]{${ACCESS_CODE_LENGTH}}$`);

// 하이픈·공백·대소문자를 무시하고, Crockford 규칙대로 O→0, I·L→1로 읽는다. 형식이 틀리면 null.
export function normalizeAccessCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return VALID.test(code) ? code : null;
}

// 사람에게 보여줄 때 4자씩 하이픈으로 묶는다.
export function formatAccessCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

export const AccessCodeSchema = z
  .string()
  .transform((value, ctx) => {
    const code = normalizeAccessCode(value);
    if (!code) {
      ctx.addIssue({ code: 'custom', message: 'INVALID_ACCESS_CODE' });
      return z.NEVER;
    }
    return code;
  });
