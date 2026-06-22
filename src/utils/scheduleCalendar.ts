import { CALENDAR_ANCHOR } from "./trialCalendar";

export { CALENDAR_ANCHOR as SCHEDULE_ANCHOR };

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function getWeekDays(anchor: Date): Date[] {
  const monday = startOfWeekMonday(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function isSameScheduleDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatScheduleDayLabel(d: Date, ko: boolean): string {
  return ko
    ? d.toLocaleDateString("ko-KR", { weekday: "short", month: "short", day: "numeric" })
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatWeekdayShort(d: Date, ko: boolean): string {
  return ko
    ? d.toLocaleDateString("ko-KR", { weekday: "short" })
    : d.toLocaleDateString("en-US", { weekday: "short" });
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}
