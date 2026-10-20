// 화면 표시용 포맷. 기기 시간대로 보여준다.

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 'YYYY-MM-DD' → '10월 20일 (화)'
export function formatLocalDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

// 'YYYY-MM-DD'에 n일을 더한다.
export function shiftLocalDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function formatKg(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)}kg`;
}

// '12:30', '1230', '9:05', '905' → { hour, minute }. 형식이 틀리면 null.
export function parseTime(text: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

// 오늘에서 daysAgo일 전의 그 시각(기기 시간대 기준).
export function eatenAtOn(now: Date, daysAgo: number, hour: number, minute: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute);
}
