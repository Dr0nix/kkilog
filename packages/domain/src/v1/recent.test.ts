import { describe, expect, it } from 'vitest';
import type { DailyTarget } from './daily-target';
import { PATTERN_MIN_DAYS, PATTERN_OVER_KCAL_RATIO, PATTERN_PROTEIN_SHORT_RATIO } from './params';
import { type RecentMeal, type RecentSummary, pickRecentHighlight, summarizeRecentDays } from './recent';

const target: DailyTarget = { kcal: 1800, carb_g: 200, protein_g: 120, fat_g: 50 };
const meal = (date: string, kcal: number, protein: number, mealType = 'lunch'): RecentMeal => ({
  date,
  mealType,
  totals: { kcal, carb_g: 50, protein_g: protein, fat_g: 20 },
});

describe('summarizeRecentDays', () => {
  const overKcal = Math.floor(target.kcal * PATTERN_OVER_KCAL_RATIO) + 1;
  const shortProtein = target.protein_g! * PATTERN_PROTEIN_SHORT_RATIO - 1;
  const meals = [
    // 18일: 두 끼 합쳐 목표 초과, 단백질 충분, 야식 있음
    meal('2026-10-18', overKcal - 500, 70),
    meal('2026-10-18', 500, 60, 'late_night'),
    // 19일: 단백질 부족
    meal('2026-10-19', 1500, shortProtein),
  ];
  const targets = new Map([
    ['2026-10-18', target],
    ['2026-10-19', target],
  ]);

  it('기록한 날만으로 평균·목표 대비를 낸다', () => {
    const summary = summarizeRecentDays(meals, targets, 7);
    expect(summary).toMatchObject({ days: 7, loggedDays: 2, averageTargetKcal: 1800 });
    expect(summary.average?.kcal).toBe(Math.round((overKcal + 1500) / 2));
    expect(summary.averageVsTargetKcal).toBe((summary.average?.kcal ?? 0) - 1800);
  });

  it('하루 합계로 목표 초과·단백질 부족한 날, 야식 먹은 날을 센다', () => {
    expect(summarizeRecentDays(meals, targets, 7)).toMatchObject({
      overTargetDays: 1,
      proteinShortDays: 1,
      lateNightDays: 1,
    });
  });

  it('기준선 바로 아래·위는 세지 않는다', () => {
    const edge = [meal('2026-10-18', Math.floor(target.kcal * PATTERN_OVER_KCAL_RATIO), target.protein_g! * PATTERN_PROTEIN_SHORT_RATIO)];
    expect(summarizeRecentDays(edge, targets, 7)).toMatchObject({ overTargetDays: 0, proteinShortDays: 0 });
  });

  it('단백질 목표가 없으면 단백질 부족은 null', () => {
    const v1 = new Map([['2026-10-19', { kcal: 1800, carb_g: null, protein_g: null, fat_g: null }]]);
    expect(summarizeRecentDays([meal('2026-10-19', 1500, 10)], v1, 7)).toMatchObject({ proteinShortDays: null, overTargetDays: 0 });
  });

  it('기록이 없으면 평균·목표 대비 없음', () => {
    expect(summarizeRecentDays([], targets, 7)).toEqual({
      days: 7,
      loggedDays: 0,
      average: null,
      averageTargetKcal: null,
      averageVsTargetKcal: null,
      overTargetDays: 0,
      proteinShortDays: null,
      lateNightDays: 0,
    });
  });
});

describe('pickRecentHighlight', () => {
  const many = PATTERN_MIN_DAYS;
  const recent: RecentSummary = {
    days: 7,
    loggedDays: 6,
    average: { kcal: 2100, carb_g: 250, protein_g: 70, fat_g: 70 },
    averageTargetKcal: 1850,
    averageVsTargetKcal: 250,
    overTargetDays: many,
    proteinShortDays: many,
    lateNightDays: many,
  };
  const today = { todayProteinShort: true, thisMealLateNight: true, todayOverTarget: true };

  it('오늘과 같은 반복이 우선: 단백질 → 야식 → 목표 초과', () => {
    expect(pickRecentHighlight({ recent, goalStatus: 'on_track', ...today })).toEqual({ kind: 'protein_short_repeat', days: many });
    expect(pickRecentHighlight({ recent, goalStatus: 'on_track', ...today, todayProteinShort: false })).toEqual({
      kind: 'late_night_repeat',
      days: many,
    });
    expect(
      pickRecentHighlight({ recent, goalStatus: 'on_track', ...today, todayProteinShort: false, thisMealLateNight: false }),
    ).toEqual({ kind: 'over_target_repeat', days: many });
  });

  it('반복이 기준보다 적으면 짚지 않는다', () => {
    const few = { ...recent, proteinShortDays: many - 1, lateNightDays: many - 1, overTargetDays: many - 1 };
    expect(pickRecentHighlight({ recent: few, goalStatus: 'on_track', ...today })).toEqual({ kind: 'on_track' });
  });

  it('반복이 없고 체중이 정체인데 평균이 목표보다 많으면 그 사실', () => {
    const none = { todayProteinShort: false, thisMealLateNight: false, todayOverTarget: false };
    expect(pickRecentHighlight({ recent, goalStatus: 'not_progressing', ...none })).toEqual({
      kind: 'average_over_not_progressing',
      averageVsTargetKcal: 250,
    });
    expect(
      pickRecentHighlight({ recent: { ...recent, averageVsTargetKcal: -50 }, goalStatus: 'not_progressing', ...none }),
    ).toBeNull();
  });

  it('기록한 날이 적으면 최근 기록은 근거로 쓰지 않고, 순항이면 격려만', () => {
    const sparse = { ...recent, loggedDays: many - 1 };
    expect(pickRecentHighlight({ recent: sparse, goalStatus: 'on_track', ...today })).toEqual({ kind: 'on_track' });
    expect(pickRecentHighlight({ recent: sparse, goalStatus: 'insufficient_data', ...today })).toBeNull();
  });
});
