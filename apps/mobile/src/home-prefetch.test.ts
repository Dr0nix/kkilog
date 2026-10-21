import { describe, expect, it } from 'vitest';
import { PREFETCH_DAYS, prefetchTargets } from './home-prefetch';

describe('prefetchTargets', () => {
  it('보고 있는 날 이전 며칠을 가까운 날부터(달 넘김)', () => {
    const targets = prefetchTargets('2026-11-02', () => false);
    expect(targets).toHaveLength(PREFETCH_DAYS);
    expect(targets.slice(0, 3)).toEqual(['2026-11-01', '2026-10-31', '2026-10-30']);
  });

  it('이미 있거나 불러오는 중인 날은 뺀다 — 하루씩 더 가면 새로 필요한 날은 하나', () => {
    const known = new Set(prefetchTargets('2026-10-21', () => false));
    expect(prefetchTargets('2026-10-20', (d) => known.has(d) || d === '2026-10-20')).toEqual([
      new Date(Date.UTC(2026, 9, 20 - PREFETCH_DAYS)).toISOString().slice(0, 10),
    ]);
  });
});
