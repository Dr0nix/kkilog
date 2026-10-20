// 추세 차트 좌표 계산(spec 2.5). 그리기는 react-native-svg, 계산은 여기서 한다.

export type ChartPoint = { date: string; weight_kg: number | null; trend_kg: number };
export type Padding = { top: number; right: number; bottom: number; left: number };

export type ChartLayout = {
  x: (index: number) => number;
  y: (kg: number) => number;
  minKg: number;
  maxKg: number;
};

// 실측·추세·목표가 전부 들어가게 세로 범위를 잡고, 위아래로 여유를 둔다.
// 값이 한 점뿐이어도 선이 납작해지지 않게 최소 폭(minSpanKg)을 둔다.
export function chartLayout(args: {
  points: readonly ChartPoint[];
  targetKg: number;
  width: number;
  height: number;
  padding: Padding;
  minSpanKg?: number;
}): ChartLayout {
  const { points, targetKg, width, height, padding, minSpanKg = 2 } = args;
  const values = [targetKg, ...points.flatMap((p) => (p.weight_kg === null ? [p.trend_kg] : [p.weight_kg, p.trend_kg]))];
  let minKg = Math.min(...values);
  let maxKg = Math.max(...values);
  const span = maxKg - minKg;
  const margin = Math.max(span * 0.1, (minSpanKg - span) / 2, 0.2);
  minKg -= margin;
  maxKg += margin;

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const last = Math.max(points.length - 1, 1);
  return {
    x: (index) => padding.left + (innerWidth * index) / last,
    y: (kg) => padding.top + innerHeight * (1 - (kg - minKg) / (maxKg - minKg)),
    minKg,
    maxKg,
  };
}
