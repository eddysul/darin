/** Local calendar day keys (YYYY-MM-DD) — app timezone = device local. */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function shiftDateKey(daysAgo: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - daysAgo);
  return formatDateKey(d);
}

export function yesterdayDateKey(from = new Date()): string {
  return shiftDateKey(1, from);
}

/** Last N calendar days inclusive of today, oldest → newest. */
export function lastNDateKeys(n: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(shiftDateKey(i, from));
  }
  return keys;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayLabelKo(dateKey: string, todayKey = formatDateKey()): string {
  if (dateKey === todayKey) return "오늘";
  if (dateKey === yesterdayDateKey(parseDateKey(todayKey))) return "어제";
  return WEEKDAY_KO[parseDateKey(dateKey).getDay()] ?? dateKey.slice(5);
}

export function shortDateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}
