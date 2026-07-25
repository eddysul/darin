/** Local calendar day keys (YYYY-MM-DD) — app timezone = device local. */
import type { DayStart } from "../types/appSettings";
import { getAppSettings } from "./appSettingsStore";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateKey(
  d = new Date(),
  dayStart: DayStart = getAppSettings().time.dayStart,
): string {
  const effective = new Date(d);
  if (dayStart === "04:00" && effective.getHours() < 4) {
    effective.setDate(effective.getDate() - 1);
  }
  return `${effective.getFullYear()}-${pad(effective.getMonth() + 1)}-${pad(effective.getDate())}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function shiftDateKey(daysAgo: number, from = new Date()): string {
  return offsetDateKey(formatDateKey(from), -daysAgo);
}

export function yesterdayDateKey(from = new Date()): string {
  return shiftDateKey(1, from);
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** Shift a YYYY-MM-DD key by ±N calendar days. */
export function offsetDateKey(dateKey: string, deltaDays: number): string {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + deltaDays);
  return formatDateKey(d, "midnight");
}

/** e.g. "오늘 7.21 (화)" · "어제 7.20 (월)" · "7.19 (일)" */
export function dayNavLabel(dateKey: string, todayKey = formatDateKey()): string {
  const d = parseDateKey(dateKey);
  const md = `${d.getMonth() + 1}.${d.getDate()}`;
  const wd = WEEKDAY_KO[d.getDay()] ?? "";
  if (dateKey === todayKey) return `오늘 ${md} (${wd})`;
  if (dateKey === offsetDateKey(todayKey, -1)) return `어제 ${md} (${wd})`;
  if (dateKey === offsetDateKey(todayKey, 1)) return `내일 ${md} (${wd})`;
  return `${md} (${wd})`;
}

/** Last N calendar days inclusive of today, oldest → newest. */
export function lastNDateKeys(n: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(shiftDateKey(i, from));
  }
  return keys;
}

export function weekdayLabelKo(dateKey: string, todayKey = formatDateKey()): string {
  if (dateKey === todayKey) return "오늘";
  if (dateKey === offsetDateKey(todayKey, -1)) return "어제";
  if (dateKey === offsetDateKey(todayKey, 1)) return "내일";
  return WEEKDAY_KO[parseDateKey(dateKey).getDay()] ?? dateKey.slice(5);
}

export function shortDateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}
