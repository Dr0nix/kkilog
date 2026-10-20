import { describe, expect, it } from 'vitest';
import { type ChartPoint, chartLayout } from './chart';

const padding = { top: 10, right: 10, bottom: 20, left: 30 };
const points: ChartPoint[] = [
  { date: '2026-10-01', weight_kg: 80, trend_kg: 80 },
  { date: '2026-10-02', weight_kg: null, trend_kg: 80 },
  { date: '2026-10-03', weight_kg: 78, trend_kg: 79.8 },
];

describe('chartLayout', () => {
  const layout = chartLayout({ points, targetKg: 70, width: 330, height: 230, padding });

  it('가로는 첫 점이 왼쪽 여백, 마지막 점이 오른쪽 끝', () => {
    expect(layout.x(0)).toBe(30);
    expect(layout.x(2)).toBe(320);
  });

  it('실측·추세·목표가 모두 세로 범위 안에 들어간다', () => {
    for (const kg of [70, 78, 80]) {
      expect(layout.y(kg)).toBeGreaterThan(padding.top);
      expect(layout.y(kg)).toBeLessThan(230 - padding.bottom);
    }
    expect(layout.y(80)).toBeLessThan(layout.y(70)); // 무거울수록 위
  });

  it('값이 한 점뿐이어도 최소 폭을 둔다', () => {
    const single = chartLayout({
      points: [{ date: '2026-10-01', weight_kg: 70, trend_kg: 70 }],
      targetKg: 70,
      width: 330,
      height: 230,
      padding,
    });
    expect(single.maxKg - single.minKg).toBeGreaterThanOrEqual(2);
    expect(single.x(0)).toBe(30);
  });
});
