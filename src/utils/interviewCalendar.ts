import type { InterviewSlot } from "../types/interview";

export type InterviewTimeOption = {
  id: string;
  labelEn: string;
  labelKo: string;
};

export const INTERVIEW_TIMES: InterviewTimeOption[] = [
  { id: "9am", labelEn: "9:00 AM", labelKo: "오전 9:00" },
  { id: "10am", labelEn: "10:00 AM", labelKo: "오전 10:00" },
  { id: "11am", labelEn: "11:00 AM", labelKo: "오전 11:00" },
  { id: "1pm", labelEn: "1:00 PM", labelKo: "오후 1:00" },
  { id: "2pm", labelEn: "2:00 PM", labelKo: "오후 2:00" },
  { id: "3pm", labelEn: "3:00 PM", labelKo: "오후 3:00" },
  { id: "4pm", labelEn: "4:00 PM", labelKo: "오후 4:00" },
];

/** Demo anchor date — matches app prototype timeline */
export const CALENDAR_ANCHOR = new Date(2026, 5, 20);

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isBeforeDay(a: Date, b: Date) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export function getMonthMatrix(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let day = 1; day <= lastDay; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatMonthTitle(year: number, month: number, ko: boolean) {
  const d = new Date(year, month, 1);
  return ko
    ? d.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })
    : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatInterviewLabels(date: Date, time: InterviewTimeOption): { en: string; ko: string } {
  const en = `${date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${time.labelEn}`;
  const ko = `${date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} (${date.toLocaleDateString("ko-KR", { weekday: "short" })}) · ${time.labelKo}`;
  return { en, ko };
}

export function buildInterviewSlot(date: Date, time: InterviewTimeOption): InterviewSlot {
  const labels = formatInterviewLabels(date, time);
  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return {
    id: `${dateKey}-${time.id}`,
    labelEn: labels.en,
    labelKo: labels.ko,
  };
}

export function parseSlotId(slotId: string): { date: Date | null; timeId: string | null } {
  const match = slotId.match(/^(\d+)-(\d+)-(\d+)-(.+)$/);
  if (!match) return { date: null, timeId: null };
  const [, y, m, d, timeId] = match;
  return { date: new Date(Number(y), Number(m) - 1, Number(d)), timeId };
}
