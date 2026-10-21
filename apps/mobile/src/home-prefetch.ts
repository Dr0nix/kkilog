import { shiftLocalDate } from './format';

// 홈에서 날짜를 넘길 때 바로 보이도록, 보고 있는 날 이전 며칠을 미리 불러둔다(spec 2.3).
export const PREFETCH_DAYS = 7;
// 미리 불러오기는 뒤에서 조용히 하되 서버에 한꺼번에 몰리지 않게 동시에 이만큼만 보낸다.
export const PREFETCH_CONCURRENCY = 2;

// viewed 이전 PREFETCH_DAYS일 중 아직 없는(가지고 있지도, 불러오는 중이지도 않은) 날. 가까운 날부터.
export function prefetchTargets(viewed: string, isKnown: (date: string) => boolean, days = PREFETCH_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => shiftLocalDate(viewed, -(i + 1))).filter((date) => !isKnown(date));
}
