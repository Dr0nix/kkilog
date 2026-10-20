import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { type ChartPoint, chartLayout } from '../chart';

const HEIGHT = 220;
const PADDING = { top: 12, right: 12, bottom: 24, left: 40 };

function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}/${day}`;
}

// 체중 그래프: 실측 점 + 추세선 + 목표 체중 기준선(spec 2.5). 차트 라이브러리 없이 직접 그린다.
export function WeightChart({ points, targetKg }: { points: readonly ChartPoint[]; targetKg: number }) {
  const [width, setWidth] = useState(0);
  const first = points[0];
  const last = points.at(-1);

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && first && last ? (
        <Chart points={points} targetKg={targetKg} width={width} firstDate={first.date} lastDate={last.date} />
      ) : null}
    </View>
  );
}

function Chart({
  points,
  targetKg,
  width,
  firstDate,
  lastDate,
}: {
  points: readonly ChartPoint[];
  targetKg: number;
  width: number;
  firstDate: string;
  lastDate: string;
}) {
  const { x, y, minKg, maxKg } = chartLayout({ points, targetKg, width, height: HEIGHT, padding: PADDING });
  const trend = points.map((p, i) => `${x(i)},${y(p.trend_kg)}`).join(' ');
  const left = PADDING.left;
  const right = width - PADDING.right;
  const labelX = left - 6;

  return (
    <Svg width={width} height={HEIGHT}>
      {/* 세로 범위 위·아래 눈금 */}
      {[maxKg, minKg].map((kg) => (
        <SvgText key={kg} x={labelX} y={y(kg) + 4} fontSize={10} fill="#999" textAnchor="end">
          {kg.toFixed(1)}
        </SvgText>
      ))}
      <Line x1={left} x2={right} y1={y(minKg)} y2={y(minKg)} stroke="#e5e5e5" />

      {/* 목표 체중 기준선 */}
      <Line x1={left} x2={right} y1={y(targetKg)} y2={y(targetKg)} stroke="#2e7d32" strokeDasharray="4 4" />
      <SvgText x={labelX} y={y(targetKg) + 4} fontSize={10} fill="#2e7d32" textAnchor="end">
        {targetKg.toFixed(1)}
      </SvgText>

      {/* 추세선 */}
      {points.length > 1 ? <Polyline points={trend} fill="none" stroke="#222" strokeWidth={2} /> : null}

      {/* 실측 점 */}
      {points.map((p, i) =>
        p.weight_kg === null ? null : <Circle key={p.date} cx={x(i)} cy={y(p.weight_kg)} r={3} fill="#4c8bf5" opacity={0.8} />,
      )}

      <SvgText x={left} y={HEIGHT - 6} fontSize={10} fill="#999">
        {shortDate(firstDate)}
      </SvgText>
      <SvgText x={right} y={HEIGHT - 6} fontSize={10} fill="#999" textAnchor="end">
        {shortDate(lastDate)}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { height: HEIGHT, width: '100%' },
});
