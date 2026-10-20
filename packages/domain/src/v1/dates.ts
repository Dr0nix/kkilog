const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`invalid local date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// 해당 타임존 기준 날짜를 'YYYY-MM-DD'로.
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// 나이는 해가 바뀌면 달라지므로 출생연도로 저장한다(±1세 오차 감수, spec 2.2).
export function birthYearFromAge(onDate: string, age: number): number {
  return parseLocalDate(onDate)[0] - age;
}

export function ageOn(onDate: string, birthYear: number): number {
  return parseLocalDate(onDate)[0] - birthYear;
}

// 기준일부터 N개월 뒤까지의 일수(달력 기준). 그 달에 같은 날이 없으면 말일로 맞춘다.
export function daysUntilMonthsLater(onDate: string, months: number): number {
  const [year, month, day] = parseLocalDate(onDate);
  const targetMonth = month - 1 + months;
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  const end = Date.UTC(year, targetMonth, Math.min(day, lastDay));
  return Math.round((end - Date.UTC(year, month - 1, day)) / DAY_MS);
}

// 해당 타임존 기준 시각을 'HH:mm'(24시간)으로.
export function localTime(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}`;
}

// 'YYYY-MM-DD'에 n일을 더한다(음수면 뺀다).
export function addDays(date: string, days: number): string {
  const [year, month, day] = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// to − from (일)
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parseLocalDate(from);
  const [y2, m2, d2] = parseLocalDate(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}
