import { describe, expect, it } from 'vitest';
import { newRequestId } from './request-id';

describe('newRequestId', () => {
  it('UUID v4 형식(서버 z.uuid()가 받는 형태)이고 매번 다르다', () => {
    const ids = Array.from({ length: 500 }, newRequestId);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19]);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
