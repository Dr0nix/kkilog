import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { TREND_ALPHA, TREND_ETA_MAX_DAYS, TREND_MIN_SPAN_DAYS, TREND_SLOPE_WINDOW_DAYS } from './params';
import {
  type TrendPoint,
  averageDailyIntake,
  goalProgress,
  totalsByDate,
  trendSlopeKgPerWeek,
  weightTrend,
} from './trend';

const round2 = (n: number) => Math.round(n * 100) / 100;

// 첫날부터 n일 동안 추세가 하루 perDay씩 바뀌는 점들
function linearPoints(days: number, perDay: number): TrendPoint[] {
  return Array.from({ length: days }, (_, i) => ({
    date: addDays('2026-10-01', i),
    weightKg: null,
    trendKg: 80 + perDay * i,
  }));
}

describe('weightTrend', () => {
  it('첫 추세는 첫 체중, 이후 trend += α × (체중 − trend)', () => {
    const points = weightTrend(
      [
        { date: '2026-10-01', weightKg: 80 },
        { date: '2026-10-02', weightKg: 79 },
      ],
      '2026-10-02',
    );
    const second = 80 + TREND_ALPHA * (79 - 80);
    expect(points).toEqual([
      { date: '2026-10-01', weightKg: 80, trendKg: 80 },
      { date: '2026-10-02', weightKg: 79, trendKg: round2(second) },
    ]);
  });

  it('기록 없는 날은 체중 null, 추세는 그대로 잇고 until까지 채운다', () => {
    const points = weightTrend(
      [
        { date: '2026-10-01', weightKg: 80 },
        { date: '2026-10-03', weightKg: 78 },
      ],
      '2026-10-05',
    );
    expect(points.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    expect(points[1]).toEqual({ date: '2026-10-02', weightKg: null, trendKg: 80 });
    expect(points[4]?.trendKg).toBe(points[2]?.trendKg);
  });

  it('기록이 없으면 빈 배열', () => {
    expect(weightTrend([], '2026-10-05')).toEqual([]);
  });
});

describe('trendSlopeKgPerWeek', () => {
  it('최근 창의 추세 변화를 주 단위로', () => {
    const points = linearPoints(TREND_SLOPE_WINDOW_DAYS + 10, -0.1);
    expect(trendSlopeKgPerWeek(points)).toBe(-0.7);
  });

  it('기록 기간이 창보다 짧으면 있는 만큼으로 계산한다', () => {
    expect(trendSlopeKgPerWeek(linearPoints(TREND_MIN_SPAN_DAYS + 1, 0.05))).toBe(0.35);
  });

  it('기록 기간이 최소 기간보다 짧으면 null', () => {
    expect(trendSlopeKgPerWeek(linearPoints(TREND_MIN_SPAN_DAYS, -0.1))).toBeNull();
    expect(trendSlopeKgPerWeek([])).toBeNull();
  });
});

describe('goalProgress', () => {
  const base = { startKg: 80, targetKg: 70, today: '2026-10-20' };

  it('감량 중이고 목표 쪽으로 가면 예상일', () => {
    // 남은 5kg, 주 0.7kg → 하루 0.1kg → 50일
    expect(goalProgress({ ...base, trendKg: 75, slopeKgPerWeek: -0.7 })).toEqual({
      status: 'on_track',
      remainingKg: 5,
      etaDate: '2026-12-09',
    });
  });

  it('증량도 같은 방식(남은 양은 음수)', () => {
    expect(goalProgress({ startKg: 60, targetKg: 65, trendKg: 62, slopeKgPerWeek: 0.7, today: '2026-10-20' })).toEqual({
      status: 'on_track',
      remainingKg: -3,
      etaDate: '2026-11-19',
    });
  });

  it('목표를 지났거나 유지 목표면 reached', () => {
    expect(goalProgress({ ...base, trendKg: 69.9, slopeKgPerWeek: -0.5 })).toMatchObject({ status: 'reached' });
    expect(goalProgress({ ...base, startKg: 70, trendKg: 71, slopeKgPerWeek: 0.5 })).toMatchObject({ status: 'reached' });
  });

  it('반대로 가거나 변화가 없으면 not_progressing', () => {
    expect(goalProgress({ ...base, trendKg: 75, slopeKgPerWeek: 0.3 })).toMatchObject({ status: 'not_progressing' });
    expect(goalProgress({ ...base, trendKg: 75, slopeKgPerWeek: 0 })).toMatchObject({ status: 'not_progressing' });
  });

  it('이 속도로 최대 기간보다 오래 걸리면 not_progressing', () => {
    const slow = (-5 / (TREND_ETA_MAX_DAYS + 1)) * 7;
    expect(goalProgress({ ...base, trendKg: 75, slopeKgPerWeek: slow })).toMatchObject({ status: 'not_progressing' });
  });

  it('기울기를 모르면 insufficient_data', () => {
    expect(goalProgress({ ...base, trendKg: 79, slopeKgPerWeek: null })).toEqual({
      status: 'insufficient_data',
      remainingKg: 9,
    });
  });
});

describe('averageDailyIntake / totalsByDate', () => {
  it('날짜별로 끼니를 더하고, 기록 있는 날만으로 평균', () => {
    const byDate = totalsByDate([
      { date: '2026-10-18', totals: { kcal: 500, carb_g: 60.1, protein_g: 20, fat_g: 10 } },
      { date: '2026-10-18', totals: { kcal: 700, carb_g: 80, protein_g: 30.05, fat_g: 20 } },
      { date: '2026-10-19', totals: { kcal: 1801, carb_g: 200, protein_g: 70, fat_g: 50 } },
    ]);
    expect(byDate.get('2026-10-18')).toEqual({ kcal: 1200, carb_g: 140.1, protein_g: 50.1, fat_g: 30 });
    expect(averageDailyIntake([...byDate.values()])).toEqual({ kcal: 1501, carb_g: 170.1, protein_g: 60.1, fat_g: 40 });
  });

  it('기록이 없으면 null', () => {
    expect(averageDailyIntake([])).toBeNull();
  });
});
